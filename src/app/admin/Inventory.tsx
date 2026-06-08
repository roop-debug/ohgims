import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface InventoryRow {
  id: string
  sku: string
  name: string
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  stock_in: number
  stock_out: number
  total_stock: number
  // --- ADDED ---
  pcs_per_unit: number
  // --- END ---
}

export default function AdminInventory() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null)

  const [data, setData] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchInventory() {
    const { data, error } = await supabase
      .from('master_inventory')
      .select(`
        inventory_id,
        sku_id,
        stock_in,
        stock_out,
        total_stock,
        status,
        skus (name, pcs_per_unit)
      `)
      // --- ADDED pcs_per_unit to select ---
      .order('date', { ascending: false })

    if (!error && data) {
      const grouped: Record<string, any> = {}
      data.forEach((row: any) => {
        if (!grouped[row.sku_id]) {
          grouped[row.sku_id] = {
            id: row.inventory_id,
            sku: row.sku_id,
            name: row.skus?.name,
            status: row.status,
            stock_in: 0,
            stock_out: 0,
            total_stock: row.total_stock,
            // --- ADDED ---
            pcs_per_unit: row.skus?.pcs_per_unit ?? 1,
            // --- END ---
          }
        }
        grouped[row.sku_id].stock_in += row.stock_in
        grouped[row.sku_id].stock_out += row.stock_out
      })
      setData(Object.values(grouped))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  // Add Item form state
  const [newSKU, setNewSKU] = useState('')
  const [newName, setNewName] = useState('')
  // --- REMOVED newUnit, ADDED newPcsPerUnit ---
  const [newPcsPerUnit, setNewPcsPerUnit] = useState('')
  // --- END ---
  const [newRate, setNewRate] = useState('')
  const [newStock, setNewStock] = useState('')
  // --- ADDED newGST ---
  const [newGST, setNewGST] = useState('')
  // --- END ---

  // Manage Stock state
  const [stockValue, setStockValue] = useState(0)

  async function handleAddItem() {
    if (!newSKU || !newName || !newRate) return

    // 1. Insert into skus
    const { error: skuError } = await supabase
      .from('skus')
      .insert({
        sku_id: newSKU,
        name: newName,
        price: parseFloat(newRate),
        // --- UPDATED gst_rate and added pcs_per_unit ---
        gst_rate: parseFloat(newGST) || 0,
        pcs_per_unit: parseInt(newPcsPerUnit) || 1,
        // --- END ---
        status: 'Active',
      })

    if (skuError) { console.error(skuError); return }

    const initialStock = Number(newStock) || 0

    // 2. Create initial master_inventory row
    const { error: invError } = await supabase
      .from('master_inventory')
      .insert({
        sku_id: newSKU,
        date: new Date().toISOString().split('T')[0],
        stock_in: initialStock,
        stock_out: 0,
        total_stock: initialStock,
        status: initialStock <= 0
          ? 'Out of Stock'
          : initialStock <= 10
          ? 'Low Stock'
          : 'In Stock',
      })

    if (invError) { console.error(invError); return }

    // 3. Create distributor_inventory for all existing distributors
    const { data: dists, error: distError } = await supabase
      .from('distributors')
      .select('distributor_id')

    if (distError) { console.error(distError); return }

    if (dists && dists.length > 0) {
      const distInvRows = dists.map((d: any) => ({
        distributor_id: d.distributor_id,
        sku_id: newSKU,
        date: new Date().toISOString().split('T')[0],
        stock_in: 0,
        stock_out: 0,
        total_stock: 0,
        status: 'Out of Stock',
      }))

      const { error: distInvError } = await supabase
        .from('distributor_inventory')
        .insert(distInvRows)

      if (distInvError) { console.error(distInvError); return }
    }

    // --- UPDATED resets - removed newUnit, added newPcsPerUnit and newGST ---
    setNewSKU('')
    setNewName('')
    setNewPcsPerUnit('')
    setNewRate('')
    setNewGST('')
    setNewStock('')
    // --- END ---
    setAddModalOpen(false)
    fetchInventory()
  }

  async function handleSaveStock() {
    if (!selectedItem) return

    const diff = stockValue - selectedItem.total_stock
    if (diff === 0) { setManageModalOpen(false); return }

    const newTotal = stockValue
    const newStatus = newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock'

    const { error } = await supabase
      .from('master_inventory')
      .insert({
        sku_id: selectedItem.sku,
        date: new Date().toISOString().split('T')[0],
        stock_in: diff > 0 ? diff : 0,
        stock_out: diff < 0 ? Math.abs(diff) : 0,
        total_stock: newTotal,
        status: newStatus,
      })

    if (error) { console.error(error); return }

    setManageModalOpen(false)
    setSelectedItem(null)
    fetchInventory()
  }

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
    { header: 'Stock In (boxes)', accessorKey: 'stock_in' },
    { header: 'Stock Out (boxes)', accessorKey: 'stock_out' },
    { header: 'Total Stock (boxes)', accessorKey: 'total_stock' },
    // --- ADDED pcs_per_unit column ---
    {
      header: 'Pcs/Box',
      accessorKey: 'pcs_per_unit',
    },
    // --- END ---
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
          loading={loading}
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

          {/* --- REPLACED Unit field with Pcs per Box --- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pcs per Box</label>
            <input
              type="number"
              value={newPcsPerUnit}
              onChange={(e) => setNewPcsPerUnit(e.target.value)}
              placeholder="e.g. 36"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          {/* --- END --- */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per Pc (₹)</label>
            {/* --- UPDATED label to make clear it's per piece --- */}
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>

          {/* --- ADDED GST field --- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
            <input
              type="number"
              value={newGST}
              onChange={(e) => setNewGST(e.target.value)}
              placeholder="e.g. 18"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          {/* --- END --- */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock (boxes)</label>
            {/* --- UPDATED label to make clear it's in boxes --- */}
            <input
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="e.g. 100"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>

          <button
            onClick={handleAddItem}
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
              {/* --- UPDATED label to show boxes --- */}
              Adjust Stock (boxes)
            </label>
            {/* --- ADDED pcs equivalent hint --- */}
            {selectedItem && (
              <p className="text-xs text-gray-400 mb-3">
                1 box = {selectedItem.pcs_per_unit} pcs — current: {stockValue * selectedItem.pcs_per_unit} pcs total
              </p>
            )}
            {/* --- END --- */}
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
            onClick={handleSaveStock}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </Modal>

    </AppLayout>
  )
}