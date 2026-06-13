import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'

interface OrderRow {
  id: string
  po_no: string
  distributor: string
  distributor_id: string
  created_at: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
  dispatch_status: 'pending' | 'in_transit' | 'delivered' | null
  dispatch_id: string | null
  cancellation_reason: string | null
}

interface OrderItem {
  id: string
  sku: string
  item_name: string
  quantity: number
  rate: number
  gst: number
  price: number
}

export default function AdminOrders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [data, setData] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // [REALTIME] Subscribe to purchase_orders changes so new orders appear without refresh.
  // Make sure Realtime is enabled on the purchase_orders table in Supabase dashboard:
  // Table Editor → purchase_orders → Realtime toggle ON
  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => {
          // Re-fetch on any INSERT or UPDATE so the list stays current
          fetchOrders()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('po_id, created_at, status, distributor_id, cancellation_reason, distributors(name), dispatches(dispatch_id, status)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.po_id,
        po_no: row.po_id,
        distributor: row.distributors?.name,
        distributor_id: row.distributor_id,
        created_at: new Date(row.created_at).toLocaleString('en-IN'),
        status: row.status,
        dispatch_status: row.dispatches?.[0]?.status ?? null,
        dispatch_id: row.dispatches?.[0]?.dispatch_id ?? null,
        cancellation_reason: row.cancellation_reason ?? null,
      })))
    }
    setLoading(false)
  }

  async function fetchOrderItems(poId: string) {
    const { data, error } = await supabase
      .from('po_line_items')
      .select('line_id, sku_id, item_name, quantity, rate, gst, price')
      .eq('po_id', poId)

    if (!error && data) {
      setOrderItems(data.map((row: any) => ({
        id: row.line_id,
        sku: row.sku_id,
        item_name: row.item_name,
        quantity: row.quantity,
        rate: row.rate,
        gst: row.gst,
        price: row.price,
      })))
    }
  }

  async function handleRowClick(row: OrderRow) {
    setSelectedOrder(row)
    setOrderItems([])
    await fetchOrderItems(row.id)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedOrder(null)
    setOrderItems([])
  }

  async function handleApprove() {
  if (!selectedOrder) return

  const insufficientItems: string[] = []

  for (const item of orderItems) {
    const { data: inv } = await supabase
      .from('master_inventory')
      .select('total_stock')
      .eq('sku_id', item.sku)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const available = inv?.total_stock ?? 0
    if (available < item.quantity) {
      insufficientItems.push(`${item.item_name} (need ${item.quantity}, have ${available})`)
    }
  }

  if (insufficientItems.length > 0) {
    alert(`Cannot approve — insufficient stock:\n${insufficientItems.join('\n')}`)
    return
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'approved' })
    .eq('po_id', selectedOrder.id)

  if (error) { console.error(error); return }

  const { error: dispatchError } = await supabase
    .from('dispatches')
    .insert({
      po_id: selectedOrder.id,
      distributor_id: selectedOrder.distributor_id,
      dispatched_at: new Date().toISOString(),
      eta: null,
      status: 'pending',
    })

  if (dispatchError) { console.error(dispatchError); return }

  // [NOTIFY] Notify the distributor their order was approved
  const { data: dist, error: distError } = await supabase
    .from('distributors')
    .select('user_id')
    .eq('distributor_id', selectedOrder.distributor_id)
    .single()

  if (distError || !dist?.user_id) {
    console.error('Could not find distributor user_id for notification', distError)
  } else {
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: dist.user_id,
        title: 'Order Approved',
        message: `Your order ${selectedOrder.po_no} has been approved and is being prepared for dispatch.`,
        url: `/distributor/orders/${selectedOrder.id}`,
        read: false,
      })
    if (notifError) console.error('Failed to insert distributor notification', notifError)
  }

  // [NOTIFY] Notify all admins of pending dispatch
  const { data: admins, error: adminsError } = await supabase
    .from('admins')
    .select('user_id')

  if (adminsError || !admins?.length) {
    console.error('Could not fetch admins for notification', adminsError)
  } else {
    const adminNotifs = admins.map((a: { user_id: string }) => ({
      user_id: a.user_id,
      title: 'Dispatch Pending',
      message: `Order ${selectedOrder.po_no} for ${selectedOrder.distributor} has been approved and is awaiting dispatch.`,
      url: '/admin/dispatch',
      read: false,
    }))

    const { error: adminNotifError } = await supabase
      .from('notifications')
      .insert(adminNotifs)

    if (adminNotifError) console.error('Failed to insert admin notifications', adminNotifError)
  }

  handleClose()
  fetchOrders()
}

  function openCancelModal() {
    setCancelReason('')
    setCancelModalOpen(true)
  }

  async function handleCancel() {
    if (!selectedOrder || !cancelReason.trim()) return
    setCancelling(true)

    const { status, dispatch_status, dispatch_id } = selectedOrder

    // Step 1: PO is dispatched (in_transit) — roll back master_inventory
    if (status === 'dispatched' && dispatch_status === 'in_transit') {
      for (const item of orderItems) {
        const { data: inv } = await supabase
          .from('master_inventory')
          .select('inventory_id, stock_out, total_stock')
          .eq('sku_id', item.sku)
          .maybeSingle()

        if (inv) {
          const { error: invError } = await supabase
            .from('master_inventory')
            .update({
              stock_out: inv.stock_out - item.quantity,
              total_stock: inv.total_stock + item.quantity,
            })
            .eq('inventory_id', inv.inventory_id)

          if (invError) { console.error(invError); setCancelling(false); return }
        }
      }
    }

    // Step 2: delete dispatch if it exists and hasn't been delivered
    if (dispatch_id && dispatch_status !== 'delivered') {
      const { error: dispatchError } = await supabase
        .from('dispatches')
        .delete()
        .eq('dispatch_id', dispatch_id)

      if (dispatchError) { console.error(dispatchError); setCancelling(false); return }
    }

    // Step 3: cancel the PO
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', cancellation_reason: cancelReason.trim() })
      .eq('po_id', selectedOrder.id)

    if (error) { console.error(error); setCancelling(false); return }

    await supabase.functions.invoke('notify-order-status', {
      body: { order_id: selectedOrder.id, new_status: 'cancelled' }
    })

    setCancelModalOpen(false)
    setCancelling(false)
    handleClose()
    fetchOrders()
  }

  const columns: ColumnDef<OrderRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'Distributor', accessorKey: 'distributor' },
    { header: 'PO No.', accessorKey: 'po_no' },
    { header: 'Purchase Date/Time', accessorKey: 'created_at' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
  ]

  const itemColumns: ColumnDef<OrderItem>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'SKU', accessorKey: 'sku' },
    { header: 'Item Name', accessorKey: 'item_name' },
    { header: 'Quantity', accessorKey: 'quantity' },
    {
      header: 'Rate',
      accessorKey: 'rate',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
    {
      header: 'GST',
      accessorKey: 'gst',
      cell: ({ getValue }) => `${getValue()}%`,
    },
    {
      header: 'Price',
      accessorKey: 'price',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Orders Overview</h1>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="orders"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No orders found"
        />
      </div>

      {/* Order detail modal */}
      <Modal
        open={modalOpen}
        title={selectedOrder ? `Order — ${selectedOrder.po_no}` : 'Order Details'}
        onClose={handleClose}
      >
        {selectedOrder && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Distributor</p>
                <p className="text-sm font-medium text-gray-900">{selectedOrder.distributor}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Date/Time</p>
                <p className="text-sm font-medium text-gray-900">{selectedOrder.created_at}</p>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line Items</p>
              <DataTable
                columns={itemColumns}
                data={orderItems}
                searchable={false}
                emptyMessage="No items in this order"
              />
              {orderItems.length > 0 && (
                <div className="flex justify-end border-t border-gray-100 pt-3 mt-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Grand Total: ₹{orderItems.reduce((sum, item) => sum + item.price, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            {/* pending — approve or cancel */}
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={openCancelModal}
                  className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Order
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
                >
                  Approve Order
                </button>
              </div>
            )}

            {/* approved — dispatch pending, can still cancel */}
            {selectedOrder.status === 'approved' && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-sm text-gray-400 text-center">
                  Order approved — manage dispatch from the Dispatch page.
                </p>
                <button
                  onClick={openCancelModal}
                  className="w-full py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {/* dispatched — in transit, admin can still cancel with rollback */}
            {selectedOrder.status === 'dispatched' && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-sm text-gray-400 text-center">
                  Order dispatched — mark delivered from the Dispatch page.
                </p>
                <button
                  onClick={openCancelModal}
                  className="w-full py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {selectedOrder.status === 'delivered' && (
              <p className="text-sm text-gray-400 text-center mt-2">Order delivered.</p>
            )}

            {selectedOrder.status === 'cancelled' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 mt-2">
                <p className="text-xs text-gray-500 mb-1">Cancellation Reason</p>
                <p className="text-sm text-gray-800">
                  {selectedOrder.cancellation_reason || '—'}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel reason modal */}
      <Modal
        open={cancelModalOpen}
        title="Cancel Order"
        onClose={() => setCancelModalOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {selectedOrder?.status === 'dispatched' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 font-medium">⚠️ Stock in transit</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Cancelling this order will restore the dispatched quantities back to master inventory.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Please provide a reason for cancelling{' '}
            <span className="font-medium text-gray-900">{selectedOrder?.po_no}</span>.
          </p>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Enter cancellation reason..."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#eb2030]/30 focus:border-[#eb2030]"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelling}
              className="flex-1 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}