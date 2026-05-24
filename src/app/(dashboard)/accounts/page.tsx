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
      <TopBar title="Roblox Accounts" subtitle="Manage your seller accounts" />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Robux</p>
              <p className="text-lg font-bold text-foreground">{totalRobux.toLocaleString()} R$</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-bold text-emerald-400">{availableRobux.toLocaleString()} R$</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Accounts</p>
              <p className="text-lg font-bold text-foreground">{activeAccounts} / {accounts.length}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">All Accounts ({accounts.length})</h2>
          <Button
            onClick={() => { setEditAccount(null); setModalOpen(true) }}
            className="gap-2 bg-primary text-primary-foreground h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add Account
          </Button>
        </div>

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
