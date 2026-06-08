import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
// --- END ---

interface OrderRow {
  id: string
  po_no: string
  distributor: string
  distributor_id: string
  created_at: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
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

  // --- ADDED data state and fetch ---
  const [data, setData] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('po_id, created_at, status, distributor_id, distributors(name)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.po_id,
        po_no: row.po_id,
        distributor: row.distributors?.name,
        distributor_id: row.distributor_id,
        created_at: new Date(row.created_at).toLocaleString('en-IN'),
        status: row.status,
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
  // --- END ---

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

  // --- ADDED status update handlers ---
  async function handleApprove() {
  if (!selectedOrder) return

  // 1. Approve the order
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'approved' })
    .eq('po_id', selectedOrder.id)

  if (error) { console.error(error); return }

  // 2. Auto-create a pending dispatch
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

  handleClose()
  fetchOrders()
}

  async function handleCancel() {
    if (!selectedOrder) return
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled' })
      .eq('po_id', selectedOrder.id)
    if (error) { console.error(error); return }
    handleClose()
    fetchOrders()
  }
  // --- END ---

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
            </div>

            {/* --- ADDED wired action buttons --- */}
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel Order
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
                >
                  Approve Order
                </button>
              </div>
            )}
            {/* Mark Dispatched and Mark Delivered are handled via Dispatch page --- */}
            {selectedOrder.status === 'approved' && (
              <p className="text-sm text-gray-400 text-center mt-2">
                Order approved — create a dispatch from the Dispatch page.
              </p>
            )}
            {selectedOrder.status === 'dispatched' && (
              <p className="text-sm text-gray-400 text-center mt-2">
                Order dispatched — mark delivered from the Dispatch page.
              </p>
            )}
            {/* --- END --- */}
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}