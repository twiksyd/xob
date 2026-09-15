-- Migration 063: First-class Roblox game identity (schema only).
--
-- Stores a game's Roblox identity (universe id, root place id, verification
-- provenance) as XOB-owned data instead of BudgetWise Store source config
-- (src/config/roblox-universe-ids.json). This migration only creates the
-- storage, the audit trail, and the single supported write path. It inserts
-- no identity rows; existing mappings are imported in a later phase.
--
-- public.games is NOT altered. Identity is a 1:1 side table keyed by the
-- existing games.id, so no game UUID, column, policy, or app type changes.
--
-- Access model (enforced by grants, not application code):
--   anon           no access to either table or the write function.
--   authenticated  SELECT (RLS-filtered) and EXECUTE on
--                  public.set_game_roblox_identity(), which authorizes via
--                  public.games.user_id -> public.can_admin_business().
--                  No direct table writes.
--   service_role   SELECT only. No EXECUTE on the write function and no
--                  direct table writes. The service-role key is shared with
--                  the BudgetWise Store runtime and scripts, which may read
--                  Roblox identity but must never change it.
--   SQL sessions   Privileged database sessions (for example a reviewed SQL
--                  migration) can still write directly, as with any table.
--                  Those writes are recorded in the audit log with
--                  write_path = 'direct_sql'.
--
-- Deleting a game that has an identity row is blocked (ON DELETE RESTRICT).
--
-- Requires migration 058 (can_access_business / can_admin_business).
-- Run in Supabase SQL Editor. Safe to run multiple times.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RAISE EXCEPTION 'Migration 063 requires public.games';
  END IF;

  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Migration 063 requires auth.uid()';
  END IF;

  IF to_regprocedure('public.can_access_business(uuid)') IS NULL
     OR to_regprocedure('public.can_admin_business(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Migration 063 requires migration 058 (can_access_business / can_admin_business)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Identity table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.game_roblox_identity (
  game_id               uuid        PRIMARY KEY REFERENCES public.games(id) ON DELETE RESTRICT,
  status                text        NOT NULL,
  universe_id           bigint,
  root_place_id         bigint,
  verified_roblox_name  text,
  verified_creator_type text,
  verified_creator_id   bigint,
  verification_method   text,
  verification_evidence jsonb       NOT NULL DEFAULT '{}'::jsonb,
  verified_at           timestamptz,
  verified_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT game_roblox_identity_status_check
    CHECK (status IN ('verified', 'not_roblox', 'needs_review')),

  CONSTRAINT game_roblox_identity_creator_type_check
    CHECK (verified_creator_type IS NULL OR verified_creator_type IN ('User', 'Group')),

  CONSTRAINT game_roblox_identity_creator_pair_check
    CHECK ((verified_creator_type IS NULL) = (verified_creator_id IS NULL)),

  CONSTRAINT game_roblox_identity_creator_id_check
    CHECK (verified_creator_id IS NULL OR verified_creator_id > 0),

  CONSTRAINT game_roblox_identity_method_check
    CHECK (
      verification_method IS NULL
      OR verification_method IN ('gamepass_overlap', 'owner_confirmed', 'legacy_json_import')
    ),

  CONSTRAINT game_roblox_identity_evidence_object_check
    CHECK (jsonb_typeof(verification_evidence) = 'object'),

  -- verified rows carry Roblox ids and provenance; the other statuses carry
  -- neither ids nor a verification snapshot (evidence and review_note stay
  -- allowed on every status).
  CONSTRAINT game_roblox_identity_shape_check
    CHECK (
      (
        status = 'verified'
        AND universe_id IS NOT NULL AND universe_id > 0
        AND root_place_id IS NOT NULL AND root_place_id > 0
        AND verification_method IS NOT NULL
        AND verified_at IS NOT NULL
      )
      OR
      (
        status IN ('not_roblox', 'needs_review')
        AND universe_id IS NULL
        AND root_place_id IS NULL
        AND verified_roblox_name IS NULL
        AND verified_creator_type IS NULL
        AND verified_creator_id IS NULL
        AND verification_method IS NULL
        AND verified_at IS NULL
        AND verified_by IS NULL
      )
    )
);

-- Two verified games can never share a Roblox universe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_roblox_identity_verified_universe_unique
  ON public.game_roblox_identity (universe_id)
  WHERE status = 'verified';

COMMENT ON TABLE public.game_roblox_identity IS
  'XOB-owned Roblox identity for a game (1:1 with public.games). Write only via public.set_game_roblox_identity().';
COMMENT ON COLUMN public.game_roblox_identity.universe_id IS
  'Roblox universe id: the identity key. Set only when status = verified.';
COMMENT ON COLUMN public.game_roblox_identity.root_place_id IS
  'Root place id reported by Roblox for universe_id (not necessarily the place an operator pasted).';
COMMENT ON COLUMN public.game_roblox_identity.verification_evidence IS
  'Supporting evidence for the identity decision (for example exact game pass name overlaps or a source file and commit). Always a JSON object.';
COMMENT ON COLUMN public.game_roblox_identity.verified_at IS
  'When this identity was last written with status = verified.';

-- -----------------------------------------------------------------------------
-- 2. Append-only audit log
-- -----------------------------------------------------------------------------
-- Deliberately no foreign keys: entries survive deletion of identity rows,
-- games, and users.

CREATE TABLE IF NOT EXISTS public.game_roblox_identity_audit_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           uuid        NOT NULL,
  business_owner_id uuid,
  action            text        NOT NULL,
  write_path        text        NOT NULL,
  previous_value    jsonb,
  next_value        jsonb,
  actor_user_id     uuid,
  actor_role        text        NOT NULL,
  operator_input    text,
  created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT game_roblox_identity_audit_action_check
    CHECK (action IN ('insert', 'update', 'delete')),

  CONSTRAINT game_roblox_identity_audit_write_path_check
    CHECK (write_path IN ('rpc', 'direct_sql')),

  CONSTRAINT game_roblox_identity_audit_value_shape_check
    CHECK (
      (action = 'insert' AND previous_value IS NULL AND next_value IS NOT NULL)
      OR (action = 'update' AND previous_value IS NOT NULL AND next_value IS NOT NULL)
      OR (action = 'delete' AND previous_value IS NOT NULL AND next_value IS NULL)
    ),

  CONSTRAINT game_roblox_identity_audit_operator_input_length_check
    CHECK (operator_input IS NULL OR char_length(operator_input) <= 2048)
);

CREATE INDEX IF NOT EXISTS idx_game_roblox_identity_audit_game_created
  ON public.game_roblox_identity_audit_log (game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_roblox_identity_audit_owner_created
  ON public.game_roblox_identity_audit_log (business_owner_id, created_at DESC);

COMMENT ON TABLE public.game_roblox_identity_audit_log IS
  'Append-only history of public.game_roblox_identity changes. No foreign keys, so entries survive deletion of identity rows, games, and users.';
COMMENT ON COLUMN public.game_roblox_identity_audit_log.business_owner_id IS
  'public.games.user_id at write time. Used for RLS so entries stay readable to the business after a game is gone.';
COMMENT ON COLUMN public.game_roblox_identity_audit_log.write_path IS
  'rpc = public.set_game_roblox_identity(); direct_sql = any other write (SQL editor, table editor, referential actions).';
COMMENT ON COLUMN public.game_roblox_identity_audit_log.operator_input IS
  'Raw operator input supplied to the write function (for example a pasted Roblox URL), if any.';

-- -----------------------------------------------------------------------------
-- 3. Trigger functions
-- -----------------------------------------------------------------------------

-- Keeps game_id immutable and maintains updated_at.
CREATE OR REPLACE FUNCTION public.guard_game_roblox_identity_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.game_id IS DISTINCT FROM OLD.game_id THEN
    RAISE EXCEPTION 'game_roblox_identity.game_id is immutable';
  END IF;

  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Records writes that bypass public.set_game_roblox_identity(). The write
-- function records its own audit entry (with operator input) and flags the
-- transaction while it writes, so its changes are not double-logged.
CREATE OR REPLACE FUNCTION public.audit_game_roblox_identity_direct_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_game_id  uuid;
  v_previous jsonb;
  v_next     jsonb;
BEGIN
  IF current_setting('xob.game_roblox_identity_rpc', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_game_id := NEW.game_id;
    v_next := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_game_id := NEW.game_id;
    v_previous := to_jsonb(OLD);
    v_next := to_jsonb(NEW);
  ELSE
    v_game_id := OLD.game_id;
    v_previous := to_jsonb(OLD);
  END IF;

  INSERT INTO public.game_roblox_identity_audit_log (
    game_id, business_owner_id, action, write_path,
    previous_value, next_value, actor_user_id, actor_role
  ) VALUES (
    v_game_id,
    (SELECT g.user_id FROM public.games g WHERE g.id = v_game_id),
    lower(TG_OP),
    'direct_sql',
    v_previous,
    v_next,
    auth.uid(),
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.role', true), ''),
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      session_user::text
    )
  );

  RETURN NULL;
END;
$$;

-- Blocks mutations that must never happen (audit UPDATE/DELETE/TRUNCATE, and
-- identity TRUNCATE, which would skip row-level auditing).
CREATE OR REPLACE FUNCTION public.block_game_roblox_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'public.% does not allow %', TG_TABLE_NAME, TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS game_roblox_identity_before_update ON public.game_roblox_identity;
CREATE TRIGGER game_roblox_identity_before_update
  BEFORE UPDATE ON public.game_roblox_identity
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_roblox_identity_update();

DROP TRIGGER IF EXISTS game_roblox_identity_audit_direct_write ON public.game_roblox_identity;
CREATE TRIGGER game_roblox_identity_audit_direct_write
  AFTER INSERT OR UPDATE OR DELETE ON public.game_roblox_identity
  FOR EACH ROW EXECUTE FUNCTION public.audit_game_roblox_identity_direct_write();

DROP TRIGGER IF EXISTS game_roblox_identity_block_truncate ON public.game_roblox_identity;
CREATE TRIGGER game_roblox_identity_block_truncate
  BEFORE TRUNCATE ON public.game_roblox_identity
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_game_roblox_identity_mutation();

DROP TRIGGER IF EXISTS game_roblox_identity_audit_log_block_update_delete ON public.game_roblox_identity_audit_log;
CREATE TRIGGER game_roblox_identity_audit_log_block_update_delete
  BEFORE UPDATE OR DELETE ON public.game_roblox_identity_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_game_roblox_identity_mutation();

DROP TRIGGER IF EXISTS game_roblox_identity_audit_log_block_truncate ON public.game_roblox_identity_audit_log;
CREATE TRIGGER game_roblox_identity_audit_log_block_truncate
  BEFORE TRUNCATE ON public.game_roblox_identity_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_game_roblox_identity_mutation();

-- -----------------------------------------------------------------------------
-- 4. Write boundary: public.set_game_roblox_identity()
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_game_roblox_identity(
  p_game_id               uuid,
  p_status                text,
  p_universe_id           bigint DEFAULT NULL,
  p_root_place_id         bigint DEFAULT NULL,
  p_verified_roblox_name  text   DEFAULT NULL,
  p_verified_creator_type text   DEFAULT NULL,
  p_verified_creator_id   bigint DEFAULT NULL,
  p_verification_method   text   DEFAULT NULL,
  p_verification_evidence jsonb  DEFAULT '{}'::jsonb,
  p_review_note           text   DEFAULT NULL,
  p_operator_input        text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_uid               uuid := auth.uid();
  v_actor_role        text;
  v_owner_id          uuid;
  v_existing          public.game_roblox_identity%ROWTYPE;
  v_found             boolean;
  v_result            public.game_roblox_identity%ROWTYPE;
  v_action            text;
  v_audit_id          uuid;
  v_conflict_game_id  uuid;
  v_conflict_owner_id uuid;
  v_name              text := NULLIF(btrim(p_verified_roblox_name), '');
  v_note              text := NULLIF(btrim(p_review_note), '');
  v_input             text := NULLIF(btrim(p_operator_input), '');
  v_evidence          jsonb := COALESCE(p_verification_evidence, '{}'::jsonb);
BEGIN
  -- 1. Caller: a user id first. The service_role branch is defensive only:
  --    neither anon nor service_role has EXECUTE, so without a user id this
  --    is reachable only from a privileged SQL session that owns the function
  --    and sets service_role JWT claims.
  IF v_uid IS NOT NULL THEN
    v_actor_role := 'authenticated';
  ELSIF COALESCE(
          NULLIF(current_setting('request.jwt.claim.role', true), ''),
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
        ) = 'service_role' THEN
    v_actor_role := 'service_role';
  ELSE
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Arguments and status/value combinations.
  IF p_game_id IS NULL THEN
    RAISE EXCEPTION 'Invalid argument: p_game_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('verified', 'not_roblox', 'needs_review') THEN
    RAISE EXCEPTION 'Invalid Roblox identity status: %', COALESCE(p_status, 'NULL') USING ERRCODE = '22023';
  END IF;

  IF p_verification_method IS NOT NULL
     AND p_verification_method NOT IN ('gamepass_overlap', 'owner_confirmed', 'legacy_json_import') THEN
    RAISE EXCEPTION 'Invalid verification_method: %', p_verification_method USING ERRCODE = '22023';
  END IF;

  IF p_verified_creator_type IS NOT NULL AND p_verified_creator_type NOT IN ('User', 'Group') THEN
    RAISE EXCEPTION 'Invalid verified_creator_type: %', p_verified_creator_type USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_evidence) <> 'object' THEN
    RAISE EXCEPTION 'verification_evidence must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'verified_roblox_name exceeds 200 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'review_note exceeds 2000 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_input) > 2048 THEN
    RAISE EXCEPTION 'operator_input exceeds 2048 characters' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'verified' THEN
    IF p_universe_id IS NULL OR p_universe_id <= 0 THEN
      RAISE EXCEPTION 'Verified identity requires a positive universe_id' USING ERRCODE = '22023';
    END IF;

    IF p_root_place_id IS NULL OR p_root_place_id <= 0 THEN
      RAISE EXCEPTION 'Verified identity requires a positive root_place_id' USING ERRCODE = '22023';
    END IF;

    IF p_verification_method IS NULL THEN
      RAISE EXCEPTION 'Verified identity requires a verification_method' USING ERRCODE = '22023';
    END IF;

    IF (p_verified_creator_type IS NULL) <> (p_verified_creator_id IS NULL) THEN
      RAISE EXCEPTION 'verified_creator_type and verified_creator_id must be supplied together' USING ERRCODE = '22023';
    END IF;

    IF p_verified_creator_id IS NOT NULL AND p_verified_creator_id <= 0 THEN
      RAISE EXCEPTION 'verified_creator_id must be positive' USING ERRCODE = '22023';
    END IF;
  ELSIF p_universe_id IS NOT NULL
     OR p_root_place_id IS NOT NULL
     OR v_name IS NOT NULL
     OR p_verified_creator_type IS NOT NULL
     OR p_verified_creator_id IS NOT NULL
     OR p_verification_method IS NOT NULL THEN
    RAISE EXCEPTION '% identity must not include universe_id, root_place_id, a verification snapshot, or verification_method', p_status
      USING ERRCODE = '22023';
  END IF;

  -- 3. Serialize writers for this game, then authorize through games.user_id.
  PERFORM pg_advisory_xact_lock(hashtextextended('public.game_roblox_identity:' || p_game_id::text, 0));

  SELECT g.user_id INTO v_owner_id
  FROM public.games g
  WHERE g.id = p_game_id
  FOR KEY SHARE;

  IF NOT FOUND OR (v_uid IS NOT NULL AND NOT public.can_admin_business(v_owner_id)) THEN
    RAISE EXCEPTION 'Game not found or access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.game_roblox_identity
  WHERE game_id = p_game_id
  FOR UPDATE;

  v_found := FOUND;

  -- 4. No-op when nothing would change.
  IF v_found
     AND v_existing.status = p_status
     AND v_existing.universe_id IS NOT DISTINCT FROM p_universe_id
     AND v_existing.root_place_id IS NOT DISTINCT FROM p_root_place_id
     AND v_existing.verified_roblox_name IS NOT DISTINCT FROM v_name
     AND v_existing.verified_creator_type IS NOT DISTINCT FROM p_verified_creator_type
     AND v_existing.verified_creator_id IS NOT DISTINCT FROM p_verified_creator_id
     AND v_existing.verification_method IS NOT DISTINCT FROM p_verification_method
     AND v_existing.verification_evidence = v_evidence
     AND v_existing.review_note IS NOT DISTINCT FROM v_note THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'game_id', p_game_id, 'status', p_status);
  END IF;

  -- 5. A verified universe belongs to exactly one game. The conflicting game
  --    id is only revealed to callers who can see that game's business.
  IF p_status = 'verified' THEN
    SELECT i.game_id, g.user_id
    INTO v_conflict_game_id, v_conflict_owner_id
    FROM public.game_roblox_identity i
    JOIN public.games g ON g.id = i.game_id
    WHERE i.status = 'verified'
      AND i.universe_id = p_universe_id
      AND i.game_id <> p_game_id
    LIMIT 1;

    IF v_conflict_game_id IS NOT NULL THEN
      IF v_uid IS NULL OR public.can_access_business(v_conflict_owner_id) THEN
        RAISE EXCEPTION 'Roblox universe % is already verified for game %', p_universe_id, v_conflict_game_id
          USING ERRCODE = '23505';
      END IF;

      RAISE EXCEPTION 'Roblox universe % is already verified for another game', p_universe_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 6. Identity write and audit entry, atomically.
  PERFORM set_config('xob.game_roblox_identity_rpc', 'on', true);

  BEGIN
    IF v_found THEN
      UPDATE public.game_roblox_identity
      SET status                = p_status,
          universe_id           = p_universe_id,
          root_place_id         = p_root_place_id,
          verified_roblox_name  = v_name,
          verified_creator_type = p_verified_creator_type,
          verified_creator_id   = p_verified_creator_id,
          verification_method   = p_verification_method,
          verification_evidence = v_evidence,
          verified_at           = CASE WHEN p_status = 'verified' THEN now() END,
          verified_by           = CASE WHEN p_status = 'verified' THEN v_uid END,
          review_note           = v_note
      WHERE game_id = p_game_id
      RETURNING * INTO v_result;

      v_action := 'update';
    ELSE
      INSERT INTO public.game_roblox_identity (
        game_id, status, universe_id, root_place_id, verified_roblox_name,
        verified_creator_type, verified_creator_id, verification_method,
        verification_evidence, verified_at, verified_by, review_note
      ) VALUES (
        p_game_id, p_status, p_universe_id, p_root_place_id, v_name,
        p_verified_creator_type, p_verified_creator_id, p_verification_method,
        v_evidence,
        CASE WHEN p_status = 'verified' THEN now() END,
        CASE WHEN p_status = 'verified' THEN v_uid END,
        v_note
      )
      RETURNING * INTO v_result;

      v_action := 'insert';
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Roblox universe % is already verified for another game', p_universe_id
        USING ERRCODE = '23505';
  END;

  INSERT INTO public.game_roblox_identity_audit_log (
    game_id, business_owner_id, action, write_path,
    previous_value, next_value, actor_user_id, actor_role, operator_input
  ) VALUES (
    p_game_id,
    v_owner_id,
    v_action,
    'rpc',
    CASE WHEN v_found THEN to_jsonb(v_existing) END,
    to_jsonb(v_result),
    v_uid,
    v_actor_role,
    v_input
  )
  RETURNING id INTO v_audit_id;

  PERFORM set_config('xob.game_roblox_identity_rpc', '', true);

  RETURN jsonb_build_object(
    'success', true,
    'noop', false,
    'action', v_action,
    'game_id', p_game_id,
    'status', v_result.status,
    'audit_id', v_audit_id
  );
END;
$$;

COMMENT ON FUNCTION public.set_game_roblox_identity(uuid, text, bigint, bigint, text, text, bigint, text, jsonb, text, text) IS
  'Only supported API write path for public.game_roblox_identity. EXECUTE is granted to authenticated only; callers must pass can_admin_business(games.user_id). anon and service_role cannot execute it. Writes the identity row and its audit entry atomically.';

-- -----------------------------------------------------------------------------
-- 5. Row level security
-- -----------------------------------------------------------------------------
-- SELECT policies only. With no INSERT/UPDATE/DELETE policies, direct writes
-- by authenticated stay denied even if a later blanket GRANT re-adds table
-- privileges. service_role bypasses RLS; its write boundary is the grants in
-- section 6.

ALTER TABLE public.game_roblox_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_roblox_identity_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business members can view game roblox identity" ON public.game_roblox_identity;
CREATE POLICY "Business members can view game roblox identity"
  ON public.game_roblox_identity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.games g
      WHERE g.id = game_roblox_identity.game_id
        AND public.can_access_business(g.user_id)
    )
  );

DROP POLICY IF EXISTS "Business owners can view game roblox identity audit" ON public.game_roblox_identity_audit_log;
CREATE POLICY "Business owners can view game roblox identity audit"
  ON public.game_roblox_identity_audit_log
  FOR SELECT
  TO authenticated
  USING (
    business_owner_id IS NOT NULL
    AND public.can_admin_business(business_owner_id)
  );

-- -----------------------------------------------------------------------------
-- 6. Grants
-- -----------------------------------------------------------------------------
-- Supabase default privileges grant new public tables and functions to anon,
-- authenticated, and service_role. Reset them explicitly.
--
-- service_role is read-only: its key is also held by the BudgetWise Store
-- runtime and scripts, so XOB-only writes are enforced here by PostgreSQL
-- (no EXECUTE on the write function, no table writes), not by convention.

REVOKE ALL ON TABLE public.game_roblox_identity FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.game_roblox_identity_audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.game_roblox_identity TO authenticated, service_role;
GRANT SELECT ON TABLE public.game_roblox_identity_audit_log TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_game_roblox_identity(uuid, text, bigint, bigint, text, text, bigint, text, jsonb, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_game_roblox_identity(uuid, text, bigint, bigint, text, text, bigint, text, jsonb, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.guard_game_roblox_identity_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.audit_game_roblox_identity_direct_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.block_game_roblox_identity_mutation() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
