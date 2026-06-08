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
  pcs_per_unit: number
  // --- ADDED ---
  price: number
  selling_price: number
  gst_rate: number
  // --- END ---
}

export default function AdminInventory() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null)
  // --- ADDED SKU details modal state ---
  const [skuModalOpen, setSkuModalOpen] = useState(false)
  const [selectedSKU, setSelectedSKU] = useState<InventoryRow | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editSellingPrice, setEditSellingPrice] = useState('')
  const [editGST, setEditGST] = useState('')
  const [editPcsPerUnit, setEditPcsPerUnit] = useState('')
  // --- END ---

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
        skus (name, pcs_per_unit, price, selling_price, gst_rate)
      `)
      // --- ADDED selling_price, price, gst_rate to select ---
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
            pcs_per_unit: row.skus?.pcs_per_unit ?? 1,
            // --- ADDED ---
            price: row.skus?.price ?? 0,
            selling_price: row.skus?.selling_price ?? 0,
            gst_rate: row.skus?.gst_rate ?? 0,
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

  useEffect(() => { fetchInventory() }, [])

  // Add Item form state
  const [newSKU, setNewSKU] = useState('')
  const [newName, setNewName] = useState('')
  const [newPcsPerUnit, setNewPcsPerUnit] = useState('')
  const [newRate, setNewRate] = useState('')
  // --- ADDED selling price state ---
  const [newSellingPrice, setNewSellingPrice] = useState('')
  // --- END ---
  const [newStock, setNewStock] = useState('')
  const [newGST, setNewGST] = useState('')

  // Manage Stock state
  const [stockValue, setStockValue] = useState(0)

  async function handleAddItem() {
    if (!newSKU || !newName || !newRate) return

    const { error: skuError } = await supabase
      .from('skus')
      .insert({
        sku_id: newSKU,
        name: newName,
        price: parseFloat(newRate),
        // --- ADDED selling_price ---
        selling_price: parseFloat(newSellingPrice) || 0,
        // --- END ---
        gst_rate: parseFloat(newGST) || 0,
        pcs_per_unit: parseInt(newPcsPerUnit) || 1,
        status: 'Active',
      })

    if (skuError) { console.error(skuError); return }

    const initialStock = Number(newStock) || 0

    const { error: invError } = await supabase
      .from('master_inventory')
      .insert({
        sku_id: newSKU,
        date: new Date().toISOString().split('T')[0],
        stock_in: initialStock,
        stock_out: 0,
        total_stock: initialStock,
        status: initialStock <= 0 ? 'Out of Stock' : initialStock <= 10 ? 'Low Stock' : 'In Stock',
      })

    if (invError) { console.error(invError); return }

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

    setNewSKU('')
    setNewName('')
    setNewPcsPerUnit('')
    setNewRate('')
    // --- ADDED reset ---
    setNewSellingPrice('')
    // --- END ---
    setNewGST('')
    setNewStock('')
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

  // --- ADDED SKU details modal handlers ---
  function handleViewSKU(row: InventoryRow) {
    setSelectedSKU(row)
    setEditMode(false)
    setSkuModalOpen(true)
  }

  function handleEnableEdit() {
    if (!selectedSKU) return
    setEditName(selectedSKU.name)
    setEditPrice(selectedSKU.price.toString())
    setEditSellingPrice(selectedSKU.selling_price.toString())
    setEditGST(selectedSKU.gst_rate.toString())
    setEditPcsPerUnit(selectedSKU.pcs_per_unit.toString())
    setEditMode(true)
  }

  async function handleSaveSKU() {
    if (!selectedSKU) return
    const { error } = await supabase
      .from('skus')
      .update({
        name: editName,
        price: parseFloat(editPrice) || 0,
        selling_price: parseFloat(editSellingPrice) || 0,
        gst_rate: parseFloat(editGST) || 0,
        pcs_per_unit: parseInt(editPcsPerUnit) || 1,
      })
      .eq('sku_id', selectedSKU.sku)
    if (error) { console.error(error); return }
    setSkuModalOpen(false)
    setSelectedSKU(null)
    setEditMode(false)
    fetchInventory()
  }

  async function handleDeleteSKU() {
    if (!selectedSKU) return
    if (!window.confirm(`Are you sure you want to delete SKU "${selectedSKU.name}"? This cannot be undone.`)) return
    const { error } = await supabase
      .from('skus')
      .delete()
      .eq('sku_id', selectedSKU.sku)
    if (error) { console.error(error); return }
    setSkuModalOpen(false)
    setSelectedSKU(null)
    fetchInventory()
  }
  // --- END ---

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

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
    { header: 'Pcs/Box', accessorKey: 'pcs_per_unit' },
    {
      header: 'Action',
      // --- UPDATED to show both Manage and Details buttons ---
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleManageStock(row.original)}
            className="text-xs text-[#E8400C] hover:underline"
          >
            Manage
          </button>
          <button
            onClick={() => handleViewSKU(row.original)}
            className="text-xs text-gray-500 hover:underline"
          >
            Details
          </button>
        </div>
      ),
      // --- END ---
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
      <Modal open={addModalOpen} title="Add Item" onClose={() => setAddModalOpen(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>SKU</label>
            <input value={newSKU} onChange={(e) => setNewSKU(e.target.value)}
              placeholder="e.g. SKU-001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Item Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Product A" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Pcs per Box</label>
            <input type="number" value={newPcsPerUnit} onChange={(e) => setNewPcsPerUnit(e.target.value)}
              placeholder="e.g. 36" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Price per Pc (₹)</label>
            <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)}
              placeholder="0.00" className={inputClass} />
          </div>
          {/* --- ADDED selling price field --- */}
          <div>
            <label className={labelClass}>Selling Price per Pc (₹)</label>
            <input type="number" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)}
              placeholder="0.00" className={inputClass} />
          </div>
          {/* --- END --- */}
          <div>
            <label className={labelClass}>GST Rate (%)</label>
            <input type="number" value={newGST} onChange={(e) => setNewGST(e.target.value)}
              placeholder="e.g. 18" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Initial Stock (boxes)</label>
            <input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)}
              placeholder="e.g. 100" className={inputClass} />
          </div>
          <button onClick={handleAddItem}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2">
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
            <label className="block text-sm font-medium text-gray-700 mb-3">Adjust Stock (boxes)</label>
            {selectedItem && (
              <p className="text-xs text-gray-400 mb-3">
                1 box = {selectedItem.pcs_per_unit} pcs — current: {stockValue * selectedItem.pcs_per_unit} pcs total
              </p>
            )}
            <div className="flex items-center gap-4">
              <button onClick={() => setStockValue((v) => Math.max(0, v - 1))}
                className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center">
                −
              </button>
              <input type="number" value={stockValue}
                onChange={(e) => setStockValue(Math.max(0, Number(e.target.value)))}
                className="w-24 text-center border border-gray-200 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
              <button onClick={() => setStockValue((v) => v + 1)}
                className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center">
                +
              </button>
            </div>
          </div>
          <button onClick={handleSaveStock}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors">
            Save Changes
          </button>
        </div>
      </Modal>

      {/* --- ADDED SKU Details Modal --- */}
      <Modal
        open={skuModalOpen}
        title={selectedSKU ? `SKU — ${selectedSKU.sku}` : 'SKU Details'}
        onClose={() => { setSkuModalOpen(false); setSelectedSKU(null); setEditMode(false) }}
      >
        {selectedSKU && (
          <div className="flex flex-col gap-4">
            {!editMode ? (
              <>
                {/* View mode */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">SKU ID</span>
                    <span className="font-medium text-gray-900">{selectedSKU.sku}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">{selectedSKU.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Price per Pc</span>
                    <span className="font-medium text-gray-900">₹{selectedSKU.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Selling Price per Pc</span>
                    <span className="font-medium text-gray-900">₹{selectedSKU.selling_price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GST Rate</span>
                    <span className="font-medium text-gray-900">{selectedSKU.gst_rate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Pcs per Box</span>
                    <span className="font-medium text-gray-900">{selectedSKU.pcs_per_unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Price per Box</span>
                    <span className="font-medium text-gray-900">
                      ₹{(selectedSKU.price * selectedSKU.pcs_per_unit).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleDeleteSKU}
                    className="flex-1 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete SKU
                  </button>
                  <button
                    onClick={handleEnableEdit}
                    className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
                  >
                    Edit Details
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Edit mode */}
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Price per Pc (₹)</label>
                    <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Selling Price per Pc (₹)</label>
                    <input type="number" value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>GST Rate (%)</label>
                    <input type="number" value={editGST} onChange={(e) => setEditGST(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Pcs per Box</label>
                    <input type="number" value={editPcsPerUnit} onChange={(e) => setEditPcsPerUnit(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSKU}
                    className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      {/* --- END --- */}

    </AppLayout>
  )
}