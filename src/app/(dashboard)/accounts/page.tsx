'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/shared/TopBar'
import AccountCard from '@/components/accounts/AccountCard'
import AccountModal from '@/components/accounts/AccountModal'
import { RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Coins } from 'lucide-react'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<RobloxAccount | null>(null)
  const supabase = createClient()

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('roblox_accounts')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) setAccounts(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function handleSave(data: {
    username: string; current_robux: number; reserved_robux: number
    status: 'active' | 'inactive' | 'banned' | 'low'; notes?: string
  }) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      username: data.username,
      current_robux: data.current_robux,
      reserved_robux: data.reserved_robux,
      status: data.status,
      notes: data.notes ?? null,
    }

    if (editAccount) {
      await supabase.from('roblox_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editAccount.id)
    } else {
      await supabase.from('roblox_accounts').insert({ ...payload, user_id: user.id })
    }

    setSaving(false)
    setModalOpen(false)
    setEditAccount(null)
    fetchAccounts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account?')) return
    await supabase.from('roblox_accounts').delete().eq('id', id)
    fetchAccounts()
  }

  function handleEdit(account: RobloxAccount) {
    setEditAccount(account)
    setModalOpen(true)
  }

  const totalRobux = accounts.reduce((s, a) => s + a.current_robux, 0)
  const availableRobux = accounts.reduce((s, a) => s + (a.current_robux - a.reserved_robux), 0)
  const activeAccounts = accounts.filter(a => a.status === 'active').length

  return (
    <div>
      <TopBar
        title="Roblox Accounts"
        subtitle="Manage your seller accounts"
        actionLabel="+ Add Account"
        onActionClick={() => { setEditAccount(null); setModalOpen(true) }}
      />

      <div className="p-5 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { label: 'Total Robux',     value: `${totalRobux.toLocaleString()} R$`,       color: '#f59e0b' },
            { label: 'Available Robux', value: `${availableRobux.toLocaleString()} R$`,   color: '#22d3ee' },
            { label: 'Active Accounts', value: `${activeAccounts} / ${accounts.length}`,  color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div key={label} className="summary-card">
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <p className="text-[12px] font-semibold" style={{ color: 'oklch(0.40 0.020 270)' }}>All Accounts ({accounts.length})</p>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card p-5 h-52 animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Coins className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No accounts yet. Add your first Roblox account.</p>
            <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2 bg-primary text-primary-foreground text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Add Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(account => (
              <AccountCard key={account.id} account={account} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <AccountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(null) }}
        onSave={handleSave}
        account={editAccount}
        loading={saving}
      />
    </div>
  )
}
