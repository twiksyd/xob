-- Tests for migration 063: first-class Roblox game identity (schema only).
--
-- Run against a disposable local database after applying migrations. This
-- file creates auth.users / games fixtures and rolls everything back. It uses
-- plain SQL (no psql meta-commands) so it also runs in an embedded Postgres
-- harness. Every check raises on failure; reaching the final SELECT means all
-- checks passed.

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
--   1111 business owner          2222 cofounder (access, not admin)
--   3333 unrelated business      4444 second active 'owner'-role member
--   Game A/B/C belong to 1111; Game D belongs to 3333.
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-063@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'cofounder-063@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'unrelated-063@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'owner-member-063@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-063@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'cofounder-063@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'unrelated-063@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'owner-member-063@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, owner_user_id)
VALUES ('ffffffff-0000-4000-8000-000000000063', 'Phase 063 Test Workspace', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
VALUES
  ('ffffffff-0000-4000-8000-000000000063', '11111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('ffffffff-0000-4000-8000-000000000063', '22222222-2222-4222-8222-222222222222', 'cofounder', 'active'),
  ('ffffffff-0000-4000-8000-000000000063', '44444444-4444-4444-8444-444444444444', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.games (id, user_id, name)
VALUES
  ('a0630000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Phase 063 Game A'),
  ('a0630000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Phase 063 Game B'),
  ('a0630000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Phase 063 Game C'),
  ('a0630000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', 'Phase 063 Game D (other business)')
ON CONFLICT DO NOTHING;

-- Sets the JWT claims both PostgREST claim styles expose to auth.uid().
CREATE FUNCTION pg_temp.act_as(p_sub text, p_role text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), true);
  PERFORM set_config('request.jwt.claim.role', COALESCE(p_role, ''), true);
  PERFORM set_config(
    'request.jwt.claims',
    CASE
      WHEN p_sub IS NULL AND p_role IS NULL THEN ''
      ELSE json_build_object('sub', p_sub, 'role', p_role)::text
    END,
    true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- T01. Security attributes and privileges
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_fn    regprocedure := 'public.set_game_roblox_identity(uuid, text, bigint, bigint, text, text, bigint, text, jsonb, text, text)'::regprocedure;
  v_table text;
  v_role  text;
  v_priv  text;
BEGIN
  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_fn) THEN
    RAISE EXCEPTION 'T01 failed: set_game_roblox_identity must be SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p, unnest(p.proconfig) AS c(setting)
    WHERE p.oid = v_fn AND c.setting LIKE 'search_path=%'
  ) THEN
    RAISE EXCEPTION 'T01 failed: set_game_roblox_identity must pin search_path';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
    IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'T01 failed: % can execute set_game_roblox_identity', v_role;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'T01 failed: authenticated cannot execute set_game_roblox_identity';
  END IF;

  FOREACH v_table IN ARRAY ARRAY['public.game_roblox_identity', 'public.game_roblox_identity_audit_log'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = v_table::regclass) THEN
      RAISE EXCEPTION 'T01 failed: RLS is not enabled on %', v_table;
    END IF;

    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('anon', v_table, v_priv) THEN
        RAISE EXCEPTION 'T01 failed: anon has % on %', v_priv, v_table;
      END IF;
    END LOOP;

    FOREACH v_role IN ARRAY ARRAY['authenticated', 'service_role'] LOOP
      IF NOT has_table_privilege(v_role, v_table, 'SELECT') THEN
        RAISE EXCEPTION 'T01 failed: % lacks SELECT on %', v_role, v_table;
      END IF;

      FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(v_role, v_table, v_priv) THEN
          RAISE EXCEPTION 'T01 failed: % has % on %', v_role, v_priv, v_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- T02. Callers without a user id or service_role JWT are rejected
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('no JWT claims', NULL, NULL),
      ('authenticated role without a user id', NULL, 'authenticated'),
      ('anon JWT role', NULL, 'anon')
    ) AS t(label, sub, role)
  LOOP
    PERFORM pg_temp.act_as(c.sub, c.role);
    v_succeeded := false;

    BEGIN
      PERFORM public.set_game_roblox_identity('a0630000-0000-4000-8000-000000000001'::uuid, 'not_roblox');
      v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Not authenticated' THEN
        RAISE EXCEPTION 'T02 % failed: expected "Not authenticated", got "%"', c.label, SQLERRM;
      END IF;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T02 % failed: call succeeded', c.label;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- T03. The anon database role cannot execute the function or read the tables
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as(NULL, 'anon');
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_game_roblox_identity('a0630000-0000-4000-8000-000000000001'::uuid, 'not_roblox');
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'permission denied%' THEN
      RAISE EXCEPTION 'T03 failed: anon got "%" instead of a privilege error', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'T03 failed: anon executed set_game_roblox_identity';
  END IF;

  BEGIN
    PERFORM 1 FROM public.game_roblox_identity;
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM 1 FROM public.game_roblox_identity_audit_log;
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'T03 failed: anon can read an identity table';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- T04. Owner writes a verified identity; audit captures the insert
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
DECLARE
  v_result jsonb;
  v_row    public.game_roblox_identity%ROWTYPE;
  v_audit  public.game_roblox_identity_audit_log%ROWTYPE;
  v_count  integer;
BEGIN
  v_result := public.set_game_roblox_identity(
    p_game_id               => 'a0630000-0000-4000-8000-000000000001',
    p_status                => 'verified',
    p_universe_id           => 900000001,
    p_root_place_id         => 900000101,
    p_verified_roblox_name  => '  Phase 063 Roblox Game  ',
    p_verified_creator_type => 'Group',
    p_verified_creator_id   => 700001,
    p_verification_method   => 'owner_confirmed',
    p_verification_evidence => '{"source": "phase-063-test"}',
    p_operator_input        => 'https://www.roblox.com/games/900000101/phase-063'
  );

  IF v_result->>'action' IS DISTINCT FROM 'insert' OR (v_result->>'noop')::boolean THEN
    RAISE EXCEPTION 'T04 failed: unexpected result %', v_result;
  END IF;

  SELECT * INTO v_row FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  IF v_row.status <> 'verified'
     OR v_row.universe_id <> 900000001
     OR v_row.root_place_id <> 900000101
     OR v_row.verified_roblox_name <> 'Phase 063 Roblox Game'
     OR v_row.verified_at IS NULL
     OR v_row.verified_by <> '11111111-1111-4111-8111-111111111111' THEN
    RAISE EXCEPTION 'T04 failed: unexpected identity row %', to_jsonb(v_row);
  END IF;

  SELECT count(*) INTO v_count FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001';
  SELECT * INTO v_audit FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  IF v_count <> 1
     OR v_audit.id::text IS DISTINCT FROM v_result->>'audit_id'
     OR v_audit.action <> 'insert'
     OR v_audit.write_path <> 'rpc'
     OR v_audit.previous_value IS NOT NULL
     OR v_audit.next_value->>'universe_id' <> '900000001'
     OR v_audit.actor_user_id <> '11111111-1111-4111-8111-111111111111'
     OR v_audit.actor_role <> 'authenticated'
     OR v_audit.business_owner_id <> '11111111-1111-4111-8111-111111111111'
     OR v_audit.operator_input <> 'https://www.roblox.com/games/900000101/phase-063' THEN
    RAISE EXCEPTION 'T04 failed: unexpected audit (count %) %', v_count, to_jsonb(v_audit);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T05. Repeating an identical write is a no-op with no audit entry
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.set_game_roblox_identity(
    p_game_id               => 'a0630000-0000-4000-8000-000000000001',
    p_status                => 'verified',
    p_universe_id           => 900000001,
    p_root_place_id         => 900000101,
    p_verified_roblox_name  => 'Phase 063 Roblox Game',
    p_verified_creator_type => 'Group',
    p_verified_creator_id   => 700001,
    p_verification_method   => 'owner_confirmed',
    p_verification_evidence => '{"source": "phase-063-test"}'
  );

  IF NOT (v_result->>'noop')::boolean THEN
    RAISE EXCEPTION 'T05 failed: identical write was not a no-op: %', v_result;
  END IF;

  IF (SELECT count(*) FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'T05 failed: no-op wrote an audit entry';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T06. Authorization goes through games.user_id -> can_admin_business()
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
  v_result    jsonb;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('unrelated user', '33333333-3333-4333-8333-333333333333', 'a0630000-0000-4000-8000-000000000001'),
      ('cofounder (access but not admin)', '22222222-2222-4222-8222-222222222222', 'a0630000-0000-4000-8000-000000000001'),
      ('owner on another business game', '11111111-1111-4111-8111-111111111111', 'a0630000-0000-4000-8000-000000000004'),
      ('owner on a missing game', '11111111-1111-4111-8111-111111111111', 'a0630000-0000-4000-8000-0000000000ff')
    ) AS t(label, sub, game_id)
  LOOP
    PERFORM pg_temp.act_as(c.sub, 'authenticated');
    v_succeeded := false;

    BEGIN
      PERFORM public.set_game_roblox_identity(c.game_id::uuid, 'needs_review');
      v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Game not found or access denied' THEN
        RAISE EXCEPTION 'T06 % failed: expected access denied, got "%"', c.label, SQLERRM;
      END IF;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T06 % failed: call succeeded', c.label;
    END IF;
  END LOOP;

  -- A second active member with the 'owner' workspace role is an admin.
  PERFORM pg_temp.act_as('44444444-4444-4444-8444-444444444444', 'authenticated');

  v_result := public.set_game_roblox_identity(
    p_game_id               => 'a0630000-0000-4000-8000-000000000001',
    p_status                => 'verified',
    p_universe_id           => 900000001,
    p_root_place_id         => 900000101,
    p_verified_roblox_name  => 'Phase 063 Roblox Game',
    p_verified_creator_type => 'Group',
    p_verified_creator_id   => 700001,
    p_verification_method   => 'owner_confirmed',
    p_verification_evidence => '{"source": "phase-063-test"}',
    p_review_note           => 'Confirmed by owner-role member'
  );

  IF v_result->>'action' IS DISTINCT FROM 'update' THEN
    RAISE EXCEPTION 'T06 failed: owner-role member update returned %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity_audit_log
    WHERE game_id = 'a0630000-0000-4000-8000-000000000001'
      AND action = 'update'
      AND actor_user_id = '44444444-4444-4444-8444-444444444444'
      AND previous_value->>'review_note' IS NULL
      AND next_value->>'review_note' = 'Confirmed by owner-role member'
  ) THEN
    RAISE EXCEPTION 'T06 failed: owner-role member update was not audited';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T07. Invalid status/value combinations and duplicates are rejected
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('missing game id',
       $q$SELECT public.set_game_roblox_identity(NULL::uuid, 'not_roblox')$q$,
       'p_game_id is required'),
      ('unknown status',
       $q$SELECT public.set_game_roblox_identity('a0630000-0000-4000-8000-000000000002'::uuid, 'maybe')$q$,
       'Invalid Roblox identity status'),
      ('missing status',
       $q$SELECT public.set_game_roblox_identity('a0630000-0000-4000-8000-000000000002'::uuid, NULL::text)$q$,
       'Invalid Roblox identity status'),
      ('verified without universe',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_root_place_id => 900000102, p_verification_method => 'owner_confirmed')$q$,
       'requires a positive universe_id'),
      ('verified with zero universe',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 0, p_root_place_id => 900000102, p_verification_method => 'owner_confirmed')$q$,
       'requires a positive universe_id'),
      ('verified without root place',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_verification_method => 'owner_confirmed')$q$,
       'requires a positive root_place_id'),
      ('verified with negative root place',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_root_place_id => -1, p_verification_method => 'owner_confirmed')$q$,
       'requires a positive root_place_id'),
      ('verified without method',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_root_place_id => 900000102)$q$,
       'requires a verification_method'),
      ('unknown method',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_root_place_id => 900000102, p_verification_method => 'fuzzy_search')$q$,
       'Invalid verification_method'),
      ('unknown creator type',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_root_place_id => 900000102, p_verification_method => 'owner_confirmed', p_verified_creator_type => 'Studio', p_verified_creator_id => 1)$q$,
       'Invalid verified_creator_type'),
      ('creator type without creator id',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000002, p_root_place_id => 900000102, p_verification_method => 'owner_confirmed', p_verified_creator_type => 'User')$q$,
       'must be supplied together'),
      ('non-object evidence',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'not_roblox', p_verification_evidence => '[]'::jsonb)$q$,
       'must be a JSON object'),
      ('not_roblox with universe',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'not_roblox', p_universe_id => 900000002)$q$,
       'must not include'),
      ('needs_review with root place',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'needs_review', p_root_place_id => 900000102)$q$,
       'must not include'),
      ('needs_review with method',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'needs_review', p_verification_method => 'owner_confirmed')$q$,
       'must not include'),
      ('not_roblox with verification snapshot',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'not_roblox', p_verified_roblox_name => 'Robux Sell')$q$,
       'must not include'),
      ('operator input too long',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'not_roblox', p_operator_input => repeat('x', 2049))$q$,
       'operator_input exceeds 2048 characters'),
      ('duplicate verified universe',
       $q$SELECT public.set_game_roblox_identity(p_game_id => 'a0630000-0000-4000-8000-000000000002', p_status => 'verified', p_universe_id => 900000001, p_root_place_id => 900000101, p_verification_method => 'owner_confirmed')$q$,
       'Roblox universe 900000001 is already verified for game a0630000-0000-4000-8000-000000000001')
    ) AS t(label, sql, expected)
  LOOP
    v_succeeded := false;

    BEGIN
      EXECUTE c.sql;
      v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
      IF position(c.expected IN SQLERRM) = 0 THEN
        RAISE EXCEPTION 'T07 % failed: expected "%", got "%"', c.label, c.expected, SQLERRM;
      END IF;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T07 % failed: call succeeded', c.label;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000002')
     OR EXISTS (SELECT 1 FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'T07 failed: a rejected call left an identity row or audit entry';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T08. The service_role API role cannot execute the write function.
--      Business owners (not service_role) write the remaining fixtures.
-- ---------------------------------------------------------------------------

-- Exactly how PostgREST presents the service-role key: service_role database
-- role plus service_role JWT claims.
SELECT pg_temp.act_as(NULL, 'service_role');
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_game_roblox_identity(
      p_game_id => 'a0630000-0000-4000-8000-000000000002',
      p_status  => 'not_roblox'
    );
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'permission denied for function set_game_roblox_identity%' THEN
      RAISE EXCEPTION 'T08 failed: service_role got "%" instead of a function privilege error', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'T08 failed: service_role executed set_game_roblox_identity';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'T08 failed: service_role attempt left an identity row';
  END IF;
END $$;

RESET ROLE;

-- The business owner classifies game B as not_roblox.
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
DECLARE
  v_result jsonb;
  v_audit  public.game_roblox_identity_audit_log%ROWTYPE;
BEGIN
  v_result := public.set_game_roblox_identity(
    p_game_id        => 'a0630000-0000-4000-8000-000000000002',
    p_status         => 'not_roblox',
    p_review_note    => 'Robux product, not a Roblox experience',
    p_operator_input => 'phase-063-test'
  );

  IF v_result->>'action' IS DISTINCT FROM 'insert' THEN
    RAISE EXCEPTION 'T08 failed: owner not_roblox insert returned %', v_result;
  END IF;

  SELECT * INTO v_audit
  FROM public.game_roblox_identity_audit_log
  WHERE game_id = 'a0630000-0000-4000-8000-000000000002';

  IF v_audit.actor_role <> 'authenticated'
     OR v_audit.actor_user_id <> '11111111-1111-4111-8111-111111111111'
     OR v_audit.write_path <> 'rpc'
     OR v_audit.operator_input <> 'phase-063-test'
     OR v_audit.business_owner_id <> '11111111-1111-4111-8111-111111111111' THEN
    RAISE EXCEPTION 'T08 failed: unexpected owner audit %', to_jsonb(v_audit);
  END IF;

  IF (SELECT verified_at FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'T08 failed: not_roblox row has verified_at';
  END IF;
END $$;

-- A different business owner administers its own game.
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333', 'authenticated');

DO $$
BEGIN
  PERFORM public.set_game_roblox_identity('a0630000-0000-4000-8000-000000000004'::uuid, 'needs_review', p_review_note => 'Other business');

  IF NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity_audit_log
    WHERE game_id = 'a0630000-0000-4000-8000-000000000004'
      AND business_owner_id = '33333333-3333-4333-8333-333333333333'
      AND actor_user_id = '33333333-3333-4333-8333-333333333333'
  ) THEN
    RAISE EXCEPTION 'T08 failed: other business owner write was not audited';
  END IF;
END $$;

-- A privileged SQL session that owns the function (for example a reviewed
-- migration) still reaches the defensive service_role branch by setting
-- service_role claims. The service_role API role above cannot.
SELECT pg_temp.act_as(NULL, 'service_role');

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  -- Without a user id the conflicting game id is revealed.
  BEGIN
    PERFORM public.set_game_roblox_identity(
      p_game_id             => 'a0630000-0000-4000-8000-000000000003',
      p_status              => 'verified',
      p_universe_id         => 900000001,
      p_root_place_id       => 900000101,
      p_verification_method => 'legacy_json_import'
    );
    v_succeeded := true;
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'Roblox universe 900000001 is already verified for game a0630000-0000-4000-8000-000000000001' THEN
      RAISE EXCEPTION 'T08 failed: unexpected duplicate message "%"', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'T08 failed: service_role duplicate universe succeeded';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T09. Status transitions clear verification fields; the partial unique
--      index only applies to verified rows
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
DECLARE
  v_row       public.game_roblox_identity%ROWTYPE;
  v_succeeded boolean := false;
BEGIN
  PERFORM public.set_game_roblox_identity(
    'a0630000-0000-4000-8000-000000000001'::uuid,
    'needs_review',
    p_review_note => 'Re-checking identity'
  );

  SELECT * INTO v_row FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  IF v_row.status <> 'needs_review'
     OR v_row.universe_id IS NOT NULL
     OR v_row.root_place_id IS NOT NULL
     OR v_row.verified_roblox_name IS NOT NULL
     OR v_row.verification_method IS NOT NULL
     OR v_row.verified_at IS NOT NULL
     OR v_row.verified_by IS NOT NULL THEN
    RAISE EXCEPTION 'T09 failed: needs_review row kept verification fields %', to_jsonb(v_row);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity_audit_log
    WHERE game_id = 'a0630000-0000-4000-8000-000000000001'
      AND action = 'update'
      AND previous_value->>'status' = 'verified'
      AND next_value->>'status' = 'needs_review'
  ) THEN
    RAISE EXCEPTION 'T09 failed: verified -> needs_review transition was not audited';
  END IF;

  -- Universe 900000001 is free again, so game B may take it.
  PERFORM public.set_game_roblox_identity(
    p_game_id             => 'a0630000-0000-4000-8000-000000000002',
    p_status              => 'verified',
    p_universe_id         => 900000001,
    p_root_place_id       => 900000101,
    p_verification_method => 'legacy_json_import'
  );

  BEGIN
    PERFORM public.set_game_roblox_identity(
      p_game_id             => 'a0630000-0000-4000-8000-000000000001',
      p_status              => 'verified',
      p_universe_id         => 900000001,
      p_root_place_id       => 900000101,
      p_verification_method => 'owner_confirmed'
    );
    v_succeeded := true;
  EXCEPTION WHEN unique_violation THEN
    IF position('already verified for game a0630000-0000-4000-8000-000000000002' IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'T09 failed: unexpected duplicate message "%"', SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'T09 failed: game A re-took a universe verified for game B';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- T10. API roles cannot write either table directly
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ($q$INSERT INTO public.game_roblox_identity (game_id, status) VALUES ('a0630000-0000-4000-8000-000000000003', 'not_roblox')$q$),
      ($q$UPDATE public.game_roblox_identity SET review_note = 'direct' WHERE game_id = 'a0630000-0000-4000-8000-000000000001'$q$),
      ($q$DELETE FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000001'$q$),
      ($q$INSERT INTO public.game_roblox_identity_audit_log (game_id, action, write_path, next_value, actor_role) VALUES ('a0630000-0000-4000-8000-000000000001', 'insert', 'rpc', '{}', 'authenticated')$q$)
    ) AS t(sql)
  LOOP
    v_succeeded := false;

    BEGIN
      EXECUTE c.sql;
      v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T10 failed: authenticated direct write succeeded: %', c.sql;
    END IF;
  END LOOP;
END $$;

RESET ROLE;

SELECT pg_temp.act_as(NULL, 'service_role');
SET LOCAL ROLE service_role;

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ($q$INSERT INTO public.game_roblox_identity (game_id, status) VALUES ('a0630000-0000-4000-8000-000000000003', 'not_roblox')$q$),
      ($q$UPDATE public.game_roblox_identity SET review_note = 'direct' WHERE game_id = 'a0630000-0000-4000-8000-000000000001'$q$),
      ($q$DELETE FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000001'$q$),
      ($q$INSERT INTO public.game_roblox_identity_audit_log (game_id, action, write_path, next_value, actor_role) VALUES ('a0630000-0000-4000-8000-000000000001', 'insert', 'rpc', '{}', 'service_role')$q$)
    ) AS t(sql)
  LOOP
    v_succeeded := false;

    BEGIN
      EXECUTE c.sql;
      v_succeeded := true;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T10 failed: service_role direct write succeeded: %', c.sql;
    END IF;
  END LOOP;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- T11. RLS: identity follows business access; audit is admin-only
--      Current rows: A needs_review (1111), B verified (1111), D needs_review (3333)
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as(NULL, NULL);

SELECT
  set_config('test063.owner_audit',
    (SELECT count(*) FROM public.game_roblox_identity_audit_log WHERE business_owner_id = '11111111-1111-4111-8111-111111111111')::text, true),
  set_config('test063.other_audit',
    (SELECT count(*) FROM public.game_roblox_identity_audit_log WHERE business_owner_id = '33333333-3333-4333-8333-333333333333')::text, true),
  set_config('test063.all_identity',
    (SELECT count(*) FROM public.game_roblox_identity)::text, true),
  set_config('test063.all_audit',
    (SELECT count(*) FROM public.game_roblox_identity_audit_log)::text, true);

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111', 'authenticated');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_roblox_identity) <> 2
     OR (SELECT count(*) FROM public.game_roblox_identity_audit_log) <> current_setting('test063.owner_audit')::bigint THEN
    RAISE EXCEPTION 'T11 failed: owner visibility';
  END IF;
END $$;
RESET ROLE;

SELECT pg_temp.act_as('44444444-4444-4444-8444-444444444444', 'authenticated');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_roblox_identity) <> 2
     OR (SELECT count(*) FROM public.game_roblox_identity_audit_log) <> current_setting('test063.owner_audit')::bigint THEN
    RAISE EXCEPTION 'T11 failed: owner-role member visibility';
  END IF;
END $$;
RESET ROLE;

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222', 'authenticated');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_roblox_identity) <> 2
     OR (SELECT count(*) FROM public.game_roblox_identity_audit_log) <> 0 THEN
    RAISE EXCEPTION 'T11 failed: cofounder should see identity but not audit';
  END IF;
END $$;
RESET ROLE;

SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333', 'authenticated');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_roblox_identity) <> 1
     OR (SELECT count(*) FROM public.game_roblox_identity_audit_log) <> current_setting('test063.other_audit')::bigint THEN
    RAISE EXCEPTION 'T11 failed: unrelated business visibility';
  END IF;
END $$;
RESET ROLE;

SELECT pg_temp.act_as(NULL, 'service_role');
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.game_roblox_identity) <> current_setting('test063.all_identity')::bigint
     OR (SELECT count(*) FROM public.game_roblox_identity_audit_log) <> current_setting('test063.all_audit')::bigint THEN
    RAISE EXCEPTION 'T11 failed: service_role should read every row';
  END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- T12. Table constraints hold even for privileged direct SQL
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as(NULL, NULL);

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('verified without verified_at',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id, root_place_id, verification_method) VALUES ('a0630000-0000-4000-8000-000000000003', 'verified', 900000003, 900000103, 'owner_confirmed')$q$,
       '23514'),
      ('verified without method',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id, root_place_id, verified_at) VALUES ('a0630000-0000-4000-8000-000000000003', 'verified', 900000003, 900000103, now())$q$,
       '23514'),
      ('not_roblox with universe',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id) VALUES ('a0630000-0000-4000-8000-000000000003', 'not_roblox', 900000003)$q$,
       '23514'),
      ('needs_review with root place',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, root_place_id) VALUES ('a0630000-0000-4000-8000-000000000003', 'needs_review', 900000103)$q$,
       '23514'),
      ('needs_review with method',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, verification_method) VALUES ('a0630000-0000-4000-8000-000000000003', 'needs_review', 'owner_confirmed')$q$,
       '23514'),
      ('unknown status',
       $q$INSERT INTO public.game_roblox_identity (game_id, status) VALUES ('a0630000-0000-4000-8000-000000000003', 'maybe')$q$,
       '23514'),
      ('non-object evidence',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, verification_evidence) VALUES ('a0630000-0000-4000-8000-000000000003', 'not_roblox', '[]')$q$,
       '23514'),
      ('unknown creator type',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id, root_place_id, verification_method, verified_at, verified_creator_type, verified_creator_id) VALUES ('a0630000-0000-4000-8000-000000000003', 'verified', 900000003, 900000103, 'owner_confirmed', now(), 'Studio', 1)$q$,
       '23514'),
      ('creator type without creator id',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id, root_place_id, verification_method, verified_at, verified_creator_type) VALUES ('a0630000-0000-4000-8000-000000000003', 'verified', 900000003, 900000103, 'owner_confirmed', now(), 'Group')$q$,
       '23514'),
      ('duplicate verified universe',
       $q$INSERT INTO public.game_roblox_identity (game_id, status, universe_id, root_place_id, verification_method, verified_at) VALUES ('a0630000-0000-4000-8000-000000000003', 'verified', 900000001, 900000101, 'owner_confirmed', now())$q$,
       '23505'),
      ('missing game',
       $q$INSERT INTO public.game_roblox_identity (game_id, status) VALUES ('a0630000-0000-4000-8000-0000000000ff', 'not_roblox')$q$,
       '23503')
    ) AS t(label, sql, expected_state)
  LOOP
    v_succeeded := false;

    BEGIN
      EXECUTE c.sql;
      v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> c.expected_state THEN
        RAISE EXCEPTION 'T12 % failed: expected SQLSTATE %, got % (%)', c.label, c.expected_state, SQLSTATE, SQLERRM;
      END IF;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T12 % failed: insert succeeded', c.label;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- T13. game_id is immutable; audit log is append-only; identity TRUNCATE is blocked
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  c           record;
  v_succeeded boolean;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('re-key identity row',
       $q$UPDATE public.game_roblox_identity SET game_id = 'a0630000-0000-4000-8000-000000000003' WHERE game_id = 'a0630000-0000-4000-8000-000000000002'$q$,
       'game_id is immutable'),
      ('truncate identity',
       $q$TRUNCATE public.game_roblox_identity$q$,
       'does not allow TRUNCATE'),
      ('update audit',
       $q$UPDATE public.game_roblox_identity_audit_log SET actor_role = 'tampered' WHERE game_id = 'a0630000-0000-4000-8000-000000000002'$q$,
       'does not allow UPDATE'),
      ('delete audit',
       $q$DELETE FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000002'$q$,
       'does not allow DELETE'),
      ('truncate audit',
       $q$TRUNCATE public.game_roblox_identity_audit_log$q$,
       'does not allow TRUNCATE')
    ) AS t(label, sql, expected)
  LOOP
    v_succeeded := false;

    BEGIN
      EXECUTE c.sql;
      v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
      IF position(c.expected IN SQLERRM) = 0 THEN
        RAISE EXCEPTION 'T13 % failed: expected "%", got "%"', c.label, c.expected, SQLERRM;
      END IF;
    END;

    IF v_succeeded THEN
      RAISE EXCEPTION 'T13 % failed: statement succeeded', c.label;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- T14. Direct SQL writes are audited, ON DELETE RESTRICT protects games, and
--      audit entries survive identity and game deletion
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_before    integer;
  v_after     integer;
  v_succeeded boolean := false;
BEGIN
  UPDATE public.game_roblox_identity
  SET review_note = 'Edited in SQL editor'
  WHERE game_id = 'a0630000-0000-4000-8000-000000000002';

  IF NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity_audit_log
    WHERE game_id = 'a0630000-0000-4000-8000-000000000002'
      AND action = 'update'
      AND write_path = 'direct_sql'
      AND operator_input IS NULL
      AND next_value->>'review_note' = 'Edited in SQL editor'
  ) THEN
    RAISE EXCEPTION 'T14 failed: direct SQL update was not audited';
  END IF;

  BEGIN
    DELETE FROM public.games WHERE id = 'a0630000-0000-4000-8000-000000000001';
    v_succeeded := true;
  EXCEPTION WHEN restrict_violation THEN
    NULL;
  END;

  IF v_succeeded OR NOT EXISTS (SELECT 1 FROM public.games WHERE id = 'a0630000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'T14 failed: a game with an identity row was deleted';
  END IF;

  SELECT count(*) INTO v_before FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  DELETE FROM public.game_roblox_identity WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  SELECT count(*) INTO v_after FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001';

  IF v_after <> v_before + 1 OR NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity_audit_log
    WHERE game_id = 'a0630000-0000-4000-8000-000000000001'
      AND action = 'delete'
      AND write_path = 'direct_sql'
      AND previous_value->>'status' = 'needs_review'
      AND next_value IS NULL
  ) THEN
    RAISE EXCEPTION 'T14 failed: identity deletion was not audited (before %, after %)', v_before, v_after;
  END IF;

  -- Without an identity row the game can be deleted again; its audit history remains.
  DELETE FROM public.games WHERE id = 'a0630000-0000-4000-8000-000000000001';

  IF (SELECT count(*) FROM public.game_roblox_identity_audit_log WHERE game_id = 'a0630000-0000-4000-8000-000000000001') <> v_after THEN
    RAISE EXCEPTION 'T14 failed: audit entries did not survive game deletion';
  END IF;
END $$;

SELECT 'game_roblox_identity tests passed' AS result;

ROLLBACK;
