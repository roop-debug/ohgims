import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface InventoryRow {
  id: string
  sku: string
  name: string
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  stock_in: number
  stock_out: number
  total_stock: number
}

// Temporary empty data — replace with Supabase fetch after DB setup
const data: InventoryRow[] = []

export default function AdminInventory() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null)

  // Add Item form state
  const [newSKU, setNewSKU] = useState('')
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newThreshold, setNewThreshold] = useState('')

  // Manage Stock state
  const [stockValue, setStockValue] = useState(0)

  function handleManageStock(row: InventoryRow) {
    setSelectedItem(row)
    setStockValue(row.total_stock)
    setManageModalOpen(true)
  }

  const columns: ColumnDef<InventoryRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    { header: 'SKU', accessorKey: 'sku' },
    { header: 'Item Name', accessorKey: 'name' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
    { header: 'Stock In', accessorKey: 'stock_in' },
    { header: 'Stock Out', accessorKey: 'stock_out' },
    { header: 'Total Stock', accessorKey: 'total_stock' },
    {
      header: 'Action',
      cell: ({ row }) => (
        <button
          onClick={() => handleManageStock(row.original)}
          className="text-xs text-[#E8400C] hover:underline"
        >
          Manage
        </button>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Inventory</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setManageModalOpen(true)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Manage Stock
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          searchable
          exportable
          exportFilename="inventory"
          todayToggle
          emptyMessage="No inventory items found"
        />

      </div>

      {/* Add Item Modal */}
      <Modal
        open={addModalOpen}
        title="Add Item"
        onClose={() => setAddModalOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              value={newSKU}
              onChange={(e) => setNewSKU(e.target.value)}
              placeholder="e.g. SKU-001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Product A"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="e.g. kg, pcs, box"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₹)</label>
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder="e.g. 10"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <button
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2"
          >
            Add Item
          </button>
        </div>
      </Modal>

      {/* Manage Stock Modal */}
      <Modal
        open={manageModalOpen}
        title={selectedItem ? `Manage Stock — ${selectedItem.name}` : 'Manage Stock'}
        onClose={() => { setManageModalOpen(false); setSelectedItem(null) }}
      >
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Adjust Stock
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStockValue((v) => Math.max(0, v - 1))}
                className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                −
              </button>
              <input
                type="number"
                value={stockValue}
                onChange={(e) => setStockValue(Math.max(0, Number(e.target.value)))}
                className="w-24 text-center border border-gray-200 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
              />
              <button
                onClick={() => setStockValue((v) => v + 1)}
                className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
          <button
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </Modal>

    </AppLayout>
  )
}