// src/app/distributor/Inventory.tsx

import { useState, useMemo } from 'react'
import AppLayout from '../../components/shared/AppLayout'

// ── Type for joined view (replace with Supabase join) ─────────────────────────
interface InventoryRow {
  sr: number
  sku: string
  itemName: string
  totalStock: number
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query joining distributor_inventory + skus
// filtered by auth().distributor_id
// const MOCK_INVENTORY: InventoryRow[] = [
//   { sr: 1, sku: 'SKU-001', itemName: 'Product A', totalStock: 240, status: 'In Stock' },
//   { sr: 2, sku: 'SKU-002', itemName: 'Product B', totalStock: 8,   status: 'Low Stock' },
//   { sr: 3, sku: 'SKU-003', itemName: 'Product C', totalStock: 0,   status: 'Out of Stock' },
// ]

const STATUS_STYLES: Record<InventoryRow['status'], string> = {
  'In Stock':     'text-green-600',
  'Low Stock':    'text-amber-500',
  'Out of Stock': 'text-red-500',
}

export default function DistributorInventory() {
  const [searchQuery, setSearchQuery] = useState('')

  // TODO: replace with Supabase query filtered by auth().distributor_id
  const [inventory] = useState<InventoryRow[]>([])

  const filteredInventory = useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return inventory
    return inventory.filter(
      (row) =>
        row.sku.toLowerCase().includes(q) ||
        row.itemName.toLowerCase().includes(q)
    )
  }, [inventory, searchQuery])

  return (
    <AppLayout>
      <div className="rounded-2xl overflow-hidden border border-[#C8102E]">

        {/* ── Red header: title + search + filters ── */}
        <div className="bg-[#C8102E] px-5 pt-4 pb-3 flex items-end gap-4">
          <div className="flex flex-col gap-3 flex-1">
            <h1 className="text-white text-sm font-bold uppercase tracking-wider">
              Inventory
            </h1>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-full bg-gray-100 text-gray-600 text-sm px-4 py-1.5 outline-none placeholder:text-gray-400"
            />
          </div>
          {/* TODO: open filter panel/drawer on click */}
          <button className="text-white text-sm font-bold hover:opacity-75 transition-opacity pb-1">
            Filters
          </button>
        </div>

        {/* ── Column headers ── */}
        <div className="grid grid-cols-[60px_1fr_2fr_1fr_1fr] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-2">
          <span className="text-[#C8102E] text-xs font-bold">Sr No.</span>
          <span className="text-[#C8102E] text-xs font-bold">SKU</span>
          <span className="text-[#C8102E] text-xs font-bold">Item Name</span>
          <span className="text-[#C8102E] text-xs font-bold">Total Stock</span>
          <span className="text-[#C8102E] text-xs font-bold">Status</span>
        </div>

        {/* ── Rows ── */}
        <div className="bg-[#FEFDE8] min-h-[400px]">
          {filteredInventory.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">
              No inventory data.
            </p>
          ) : (
            filteredInventory.map((row) => (
              <div
                key={row.sr}
                className="grid grid-cols-[60px_1fr_2fr_1fr_1fr] px-4 py-3 border-b border-[#E0DDB0]"
              >
                <span className="text-sm text-gray-800">{row.sr}</span>
                <span className="text-sm text-gray-800">{row.sku}</span>
                <span className="text-sm text-gray-800">{row.itemName}</span>
                <span className="text-sm text-gray-800">{row.totalStock}</span>
                <span className={`text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                  {row.status}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </AppLayout>
  )
}