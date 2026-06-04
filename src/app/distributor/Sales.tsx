// src/app/distributor/Sales.tsx

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SalesRow {
  sr: number
  items: string
  sku: string
  unitsSold: number
  sellingPrice: number
  totalRevenue: number
}

interface SalesFormLine {
  id: number
  skuId: string
  skuName: string
  quantity: number
  sellingPrice: number
  revenue: number
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query filtered by auth().distributor_id
// const MOCK_SALES: SalesRow[] = [
//   { sr: 1, items: 'Product A', sku: 'SKU-001', unitsSold: 20, sellingPrice: 95,  totalRevenue: 1900 },
//   { sr: 2, items: 'Product B', sku: 'SKU-002', unitsSold: 10, sellingPrice: 180, totalRevenue: 1800 },
// ]

// TODO: replace with Supabase query to fetch distributor's inventory SKUs
// const MOCK_SKUS = [
//   { id: 'sku-1', name: 'Product A' },
//   { id: 'sku-2', name: 'Product B' },
// ]

let lineIdCounter = 0

function makeEmptyLine(): SalesFormLine {
  return {
    id:           ++lineIdCounter,
    skuId:        '',
    skuName:      '',
    quantity:     0,
    sellingPrice: 0,
    revenue:      0,
  }
}

export default function DistributorSales() {
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [lines, setLines]             = useState<SalesFormLine[]>([makeEmptyLine()])

  // TODO: replace with Supabase query filtered by auth().distributor_id
  const [sales] = useState<SalesRow[]>([])

  // TODO: replace with Supabase query to fetch distributor's inventory SKUs
  const [skus] = useState<{ id: string; name: string }[]>([])

  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return sales
    return sales.filter(
      (s) =>
        s.items.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q)
    )
  }, [sales, searchQuery])

  const totalRevenue = useMemo(
    () => lines.reduce((sum, l) => sum + l.revenue, 0),
    [lines]
  )

  function handleOpenModal() {
    setLines([makeEmptyLine()])
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
  }

  function handleAddLine() {
    setLines((prev) => [...prev, makeEmptyLine()])
  }

  function handleRemoveLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function handleLineSkuChange(id: number, skuId: string) {
    const selected = skus.find((s) => s.id === skuId)
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, skuId, skuName: selected?.name ?? '' }
          : l
      )
    )
  }

  function handleLineQuantityChange(id: number, value: string) {
    const quantity = Math.max(0, parseInt(value) || 0)
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, quantity, revenue: quantity * l.sellingPrice }
          : l
      )
    )
  }

  function handleLineSellingPriceChange(id: number, value: string) {
    const sellingPrice = Math.max(0, parseFloat(value) || 0)
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, sellingPrice, revenue: l.quantity * sellingPrice }
          : l
      )
    )
  }

  async function handleSubmitSales() {
    const validLines = lines.filter((l) => l.skuId && l.quantity > 0)
    if (validLines.length === 0) return
    // TODO: Supabase insert into sales for each validLine with auth().distributor_id
    // TODO: Supabase update distributor_inventory — deduct quantity for each SKU
    // TODO: refetch sales after insert
    handleCloseModal()
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* ── Top buttons ── */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/distributor/claims')}
            className="flex items-center gap-1.5 bg-[#FEFDE8] text-[#C8102E] text-sm font-bold px-4 py-2 rounded-full border border-[#C8102E] hover:brightness-95 transition-all"
          >
            <span className="text-base leading-none">⊕</span>
            Create Claim
          </button>
        </div>

        {/* ── Sales card ── */}
        <div className="rounded-2xl overflow-hidden border border-[#C8102E]">

          {/* Red header */}
          <div className="bg-[#C8102E] px-5 pt-4 pb-3 flex items-start justify-between">
            <div className="flex flex-col gap-3 flex-1">
              <h1 className="text-white text-sm font-bold uppercase tracking-wider">
                Sales
              </h1>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder=""
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 rounded-full bg-white/90 text-gray-600 text-sm px-4 py-1.5 outline-none placeholder:text-gray-400"
                />
                {/* TODO: open filter panel/drawer on click */}
                <button className="text-white text-sm font-semibold hover:opacity-75 transition-opacity">
                  Filters
                </button>
              </div>
            </div>
            {/* Manage button */}
            <button
              onClick={handleOpenModal}
              className="bg-[#FEFDE8] text-[#C8102E] text-sm font-bold px-5 py-2 rounded-full hover:brightness-95 transition-all"
            >
              Manage
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-2">
            <span className="text-[#C8102E] text-xs font-bold">Sr No.</span>
            <span className="text-[#C8102E] text-xs font-bold">Items</span>
            <span className="text-[#C8102E] text-xs font-bold">SKU's</span>
            <span className="text-[#C8102E] text-xs font-bold">Units sold</span>
            <span className="text-[#C8102E] text-xs font-bold">Selling Price</span>
            <span className="text-[#C8102E] text-xs font-bold">Total Revenue</span>
          </div>

          {/* Rows */}
          <div className="bg-[#FEFDE8] min-h-[400px]">
            {filteredSales.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                No sales recorded.
              </p>
            ) : (
              filteredSales.map((row) => (
                <div
                  key={row.sr}
                  className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#E0DDB0]"
                >
                  <span className="text-sm text-gray-800">{row.sr}</span>
                  <span className="text-sm text-gray-800">{row.items}</span>
                  <span className="text-sm text-gray-800">{row.sku}</span>
                  <span className="text-sm text-gray-800">{row.unitsSold}</span>
                  <span className="text-sm text-gray-800">₹{row.sellingPrice}</span>
                  <span className="text-sm text-gray-800">₹{row.totalRevenue.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* ── Log Sales Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-2xl bg-[#FEFDE8] rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[#C8102E] text-sm font-bold uppercase tracking-wider">
                Log Sales
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-[#C8102E] text-lg font-bold hover:opacity-75 transition-opacity"
              >
                X
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_32px] gap-2">
              <span className="text-[#C8102E] text-xs font-bold">SKU</span>
              <span className="text-[#C8102E] text-xs font-bold">Quantity</span>
              <span className="text-[#C8102E] text-xs font-bold">Selling Price</span>
              <span className="text-[#C8102E] text-xs font-bold">Revenue</span>
              <span />
            </div>

            {/* Lines */}
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_32px] gap-2 items-center">
                {/* SKU selector */}
                <select
                  value={line.skuId}
                  onChange={(e) => handleLineSkuChange(line.id, e.target.value)}
                  className="bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                >
                  {/* TODO: populate from Supabase SKUs */}
                  <option value="">Select SKU</option>
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Quantity */}
                <input
                  type="number"
                  min={0}
                  value={line.quantity || ''}
                  placeholder="0"
                  onChange={(e) => handleLineQuantityChange(line.id, e.target.value)}
                  className="bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                />

                {/* Selling Price */}
                <input
                  type="number"
                  min={0}
                  value={line.sellingPrice || ''}
                  placeholder="₹0"
                  onChange={(e) => handleLineSellingPriceChange(line.id, e.target.value)}
                  className="bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                />

                {/* Auto-calculated revenue */}
                <input
                  type="text"
                  value={line.revenue ? `₹${line.revenue.toLocaleString()}` : ''}
                  readOnly
                  placeholder="₹0"
                  className="bg-gray-100 border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-500 outline-none"
                />

                {/* Remove line */}
                <button
                  onClick={() => handleRemoveLine(line.id)}
                  className="text-[#C8102E] text-lg font-bold hover:opacity-75 transition-opacity text-center"
                >
                  −
                </button>
              </div>
            ))}

            {/* Add line */}
            <button
              onClick={handleAddLine}
              className="flex items-center gap-1.5 text-[#C8102E] text-sm font-bold hover:opacity-75 transition-opacity self-start"
            >
              <span className="text-base leading-none">⊕</span>
              Add SKU
            </button>

            {/* Total revenue */}
            <div className="flex justify-end border-t border-[#E0DDB0] pt-3">
              <span className="text-[#C8102E] text-sm font-bold">
                Total Revenue: ₹{totalRevenue.toLocaleString()}
              </span>
            </div>

            {/* Cancel / Submit */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="text-[#C8102E] text-sm font-bold px-6 py-2 rounded-full border border-[#C8102E] hover:bg-[#C8102E]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitSales}
                className="bg-[#C8102E] text-white text-sm font-bold px-6 py-2 rounded-full hover:brightness-90 transition-all"
              >
                Submit
              </button>
            </div>

          </div>
        </div>
      )}

    </AppLayout>
  )
}