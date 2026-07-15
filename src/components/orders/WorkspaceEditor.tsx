'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import OrderForm, { orderFormSchema, OrderFormData, GamepassWithGame } from './OrderForm'
import { useOrderCart } from '@/hooks/useOrderCart'
import { WorkspaceDraft } from '@/hooks/useWorkspaces'
import { RobloxAccount, OrderWithDetails, LineItem } from '@/lib/types/database'
import { calculateOrderTotals } from '@/lib/utils/pricing'
import { useToast } from '@/components/shared/Toast'

interface WorkspaceEditorProps {
  // Keyed by workspace.id in parent — remounts fresh on every tab switch
  workspace: WorkspaceDraft
  editOrder: OrderWithDetails | null
  gamepasses: GamepassWithGame[]
  accounts: RobloxAccount[]
  gameActivity: Map<string, Date | null>
  onUpdate: (id: string, updates: Partial<WorkspaceDraft>) => void
  onSubmit: (workspaceId: string, formData: OrderFormData, cartItems: LineItem[]) => Promise<void>
  onClose: () => void
}

export default function WorkspaceEditor({
  workspace,
  editOrder,
  gamepasses,
  accounts,
  gameActivity,
  onUpdate,
  onSubmit,
  onClose,
}: WorkspaceEditorProps) {
  const [saving, setSaving] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const toast = useToast()

  // Pass persisted items to the cart hook so it initialises with them on mount,
  // avoiding the race where the cart sync effect fires before setItems resolves.
  const cart = useOrderCart(gamepasses, workspace.items)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      buyer_name:            workspace.formValues.buyer_name            ?? '',
      buyer_roblox_username: workspace.formValues.buyer_roblox_username ?? '',
      roblox_account_id:     workspace.formValues.roblox_account_id     ?? '',
      payment_method:        workspace.formValues.payment_method        ?? 'GCash',
      status:                workspace.formValues.status                ?? 'pending',
      notes:                 workspace.formValues.notes                 ?? '',
    },
  })

  // Sync form field changes → parent draft (buyer name shows in tab, etc.)
  // The first callback fires immediately with the default values — skip it.
  const isFirstFormSync = useRef(true)
  useEffect(() => {
    const subscription = watch(values => {
      if (isFirstFormSync.current) { isFirstFormSync.current = false; return }
      onUpdate(workspace.id, { formValues: values as Partial<OrderFormData>, isDirty: true })
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, onUpdate, workspace.id])

  // Sync cart changes → parent draft (GP count + game color in tab)
  // The first run reflects the initialised state — preserve existing isDirty.
  const isFirstCartSync = useRef(true)
  useEffect(() => {
    const primaryGameName = cart.items.find(i => i.game_name)?.game_name ?? null
    if (isFirstCartSync.current) {
      isFirstCartSync.current = false
      onUpdate(workspace.id, { items: cart.items, primaryGameName })
    } else {
      onUpdate(workspace.id, { items: cart.items, primaryGameName, isDirty: true })
    }
  }, [cart.items, onUpdate, workspace.id])

  // Derive the game ID to pre-select in the catalog on mount, from the
  // primary game name stored in the workspace draft.
  const initialCatalogGameId = useMemo(() => {
    if (!workspace.primaryGameName) return null
    return gamepasses.find(gp => gp.games?.name === workspace.primaryGameName)?.game_id ?? null
  }, [workspace.primaryGameName, gamepasses])

  const accountId = watch('roblox_account_id')
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId) ?? null,
    [accountId, accounts]
  )
  const accountRate    = selectedAccount?.robux_cost_rate ?? 0
  const isAccountPlus = selectedAccount?.is_plus_account ?? false

  const totals = useMemo(
    () => calculateOrderTotals(cart.items, accountRate, isAccountPlus),
    [cart.items, accountRate, isAccountPlus]
  )

  async function handleFormSubmit(data: OrderFormData) {
    if (cart.validItems.length === 0) return
    setSaving(true)
    try {
      await onSubmit(workspace.id, data, cart.validItems)
      // On new-order success: reset for next order. Edit-order success closes
      // the workspace from the parent (no action needed here).
      if (!workspace.editOrderId) {
        const blank: OrderFormData = {
          buyer_name: '', buyer_roblox_username: '',
          roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '',
        }
        reset(blank)
        cart.clearCart()
        isFirstFormSync.current = true
        isFirstCartSync.current = true
        onUpdate(workspace.id, { isDirty: false, items: [], primaryGameName: null, formValues: blank })
        setJustCreated(true)
        setTimeout(() => setJustCreated(false), 1800)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OrderForm
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      onFormSubmit={handleSubmit(handleFormSubmit, formErrors => {
        const firstMsg = Object.values(formErrors)[0]?.message
        toast.error(
          typeof firstMsg === 'string'
            ? firstMsg
            : 'Please fix the highlighted fields before submitting.'
        )
      })}
      isEditMode={workspace.editOrderId !== null}
      editOrder={editOrder}
      onCancelEdit={onClose}
      gamepasses={gamepasses}
      accounts={accounts}
      gameActivity={gameActivity}
      initialCatalogGameId={initialCatalogGameId}
      cartGroups={cart.cartGroups}
      cartCounts={cart.cartCounts}
      validItemsCount={cart.validItems.length}
      onAddToCart={cart.addToCart}
      onRemoveFromCart={cart.removeFromCart}
      onClearCart={cart.clearCart}
      totals={totals}
      accountRate={accountRate}
      isAccountPlus={isAccountPlus}
      saving={saving}
      justCreated={justCreated}
    />
  )
}
