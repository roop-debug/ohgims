import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface OrderRow {
  id: string
  po_no: string
  created_at: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
  eta: string | null
  dispatch_status: 'pending' | 'in_transit' | 'delivered' | null
  dispatch_id: string | null
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

export default function DistributorOrders() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (profile?.distributor_id) fetchOrders()
  }, [profile])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('po_id, created_at, status, eta, dispatches(dispatch_id, status)')
      .eq('distributor_id', profile?.distributor_id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.po_id,
        po_no: row.po_id,
        created_at: row.created_at,
        status: row.status,
        eta: row.eta,
        dispatch_status: row.dispatches?.[0]?.status ?? null,
        dispatch_id: row.dispatches?.[0]?.dispatch_id ?? null,
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

  function openCancelModal() {
    setCancelReason('')
    setCancelModalOpen(true)
  }

  async function handleCancel() {
    if (!selectedOrder || !cancelReason.trim()) return
    setCancelling(true)

    const { dispatch_id, dispatch_status } = selectedOrder

    // Delete the dispatch if it exists and is still pending (no stock has moved)
    if (dispatch_id && dispatch_status === 'pending') {
      const { error: dispatchError } = await supabase
        .from('dispatches')
        .delete()
        .eq('dispatch_id', dispatch_id)

      if (dispatchError) { console.error(dispatchError); setCancelling(false); return }
    }

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

  // Distributor can cancel only if dispatch hasn't gone in_transit yet
  function canDistributorCancel(order: OrderRow) {
    if (order.status === 'pending') return true
    if (order.status === 'approved' && order.dispatch_status === 'pending') return true
    return false
  }

  const columns: ColumnDef<OrderRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'PO No.', accessorKey: 'po_no' },
    {
      header: 'Purchase Date/Time',
      accessorKey: 'created_at',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleString('en-IN'),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
    {
      header: 'ETA',
      accessorKey: 'eta',
      cell: ({ getValue }) => getValue() ? new Date(getValue() as string).toLocaleDateString('en-IN') : '—',
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Orders Overview</h1>
          <button
            onClick={() => navigate('/distributor/orders/create')}
            className="px-4 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
          >
            + Create Orders
          </button>
        </div>

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

        <div className="flex justify-end">
          <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Export to sheets
          </button>
        </div>
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
                <p className="text-xs text-gray-500">PO No.</p>
                <p className="text-sm font-medium text-gray-900">{selectedOrder.po_no}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Date/Time</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ETA</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedOrder.eta ? new Date(selectedOrder.eta).toLocaleDateString('en-IN') : '—'}
                </p>
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

            {canDistributorCancel(selectedOrder) && (
              <div className="flex mt-2">
                <button
                  onClick={openCancelModal}
                  className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {selectedOrder.status === 'dispatched' && (
              <p className="text-sm text-gray-400 text-center mt-2">
                Your order is on the way.
              </p>
            )}
            {selectedOrder.status === 'delivered' && (
              <p className="text-sm text-gray-400 text-center mt-2">
                Order delivered.
              </p>
            )}
            {selectedOrder.status === 'cancelled' && (
              <p className="text-sm text-gray-400 text-center mt-2">
                Order cancelled.
              </p>
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