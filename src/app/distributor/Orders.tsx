import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface OrderRow {
  id: string
  po_no: string
  created_at: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
  eta: string | null
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

export default function DistributorOrders() {
  const [loading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [orderItems] = useState<OrderItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()

  function handleRowClick(row: OrderRow) {
    setSelectedOrder(row)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedOrder(null)
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Orders Overview</h1>
          <button
            onClick={() => navigate('/distributor/orders/create')}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            + Create Orders
          </button>
        </div>

        {/* Table */}
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

        {/* Export to sheets */}
        <div className="flex justify-end">
          <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Export to sheets
          </button>
        </div>

      </div>

      {/* Order Details Modal */}
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

          </div>
        )}
      </Modal>

    </AppLayout>
  )
}