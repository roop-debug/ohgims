import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface OrderRow {
  id: string
  po_no: string
  distributor: string
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

const data: OrderRow[] = []

export default function AdminOrders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  function handleRowClick(row: OrderRow) {
    setSelectedOrder(row)
    setOrderItems([]) // replace with Supabase fetch after DB setup
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedOrder(null)
    setOrderItems([])
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

        {/* Header */}
        <h1 className="text-lg font-semibold text-gray-900">Orders Overview</h1>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          searchable
          exportable
          exportFilename="orders"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No orders found"
        />

      </div>

      {/* Order Details Modal */}
      <Modal
        open={modalOpen}
        title={selectedOrder ? `Order — ${selectedOrder.po_no}` : 'Order Details'}
        onClose={handleClose}
      >
        {selectedOrder && (
          <div className="flex flex-col gap-4">

            {/* Order meta */}
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

            {/* Line items table */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Line Items
              </p>
              <DataTable
                columns={itemColumns}
                data={orderItems}
                searchable={false}
                emptyMessage="No items in this order"
              />
            </div>

            {/* Status update */}
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-3 mt-2">
                <button className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel Order
                </button>
                <button className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors">
                  Approve Order
                </button>
              </div>
            )}
            {selectedOrder.status === 'approved' && (
              <button className="w-full py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors mt-2">
                Mark Dispatched
              </button>
            )}
            {selectedOrder.status === 'dispatched' && (
              <button className="w-full py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors mt-2">
                Mark Delivered
              </button>
            )}

          </div>
        )}
      </Modal>

    </AppLayout>
  )
}