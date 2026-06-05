// src/app/distributor/CreateOrder.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'

// ── Type for SKU row in the order form ────────────────────────────────────────
interface OrderFormRow {
  skuId: string
  name: string
  quantity: number
  price: number      // SKU.rate
  gst: number        // GST percentage
  totalPrice: number // auto-calculated: (price * quantity) + gst amount
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query to fetch all SKUs on mount
// const MOCK_SKUS = [
//   { id: 'sku-1', name: 'Product A', unit: 'box', rate: 100, gst: 18 },
//   { id: 'sku-2', name: 'Product B', unit: 'box', rate: 200, gst: 12 },
// ]

function calcTotalPrice(price: number, quantity: number, gst: number): number {
  const base = price * quantity
  return base + (base * gst) / 100
}

export default function DistributorCreateOrder() {
  const navigate = useNavigate()

  // TODO: replace with Supabase query — fetch all SKUs and map to OrderFormRow[]
  // useEffect(() => {
  //   const fetchedSkus = await supabase.from('skus').select('*')
  //   setRows(fetchedSkus.data.map((sku) => ({
  //     skuId: sku.id,
  //     name: sku.name,
  //     quantity: 0,
  //     price: sku.rate,
  //     gst: sku.gst ?? 0,
  //     totalPrice: 0,
  //   })))
  // }, [])
  const [rows, setRows] = useState<OrderFormRow[]>([])

  function handleQuantityChange(skuId: string, value: string) {
    const quantity = Math.max(0, parseInt(value) || 0)
    setRows((prev) =>
      prev.map((row) =>
        row.skuId === skuId
          ? { ...row, quantity, totalPrice: calcTotalPrice(row.price, quantity, row.gst) }
          : row
      )
    )
  }

  async function handleReleasePurchaseOrder() {
    const selectedRows = rows.filter((r) => r.quantity > 0)
    if (selectedRows.length === 0) return
    // TODO: Supabase insert into purchase_orders for auth().distributor_id
    // TODO: Supabase insert into order_items for each selectedRow
    // TODO: navigate to /distributor/orders after success
    navigate('/distributor/orders')
  }

  function handleCancel() {
    navigate('/distributor/orders')
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* ── Create Claim shortcut ── */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/distributor/claims')}
            className="flex items-center gap-1.5 bg-[#FEFDE8] text-[#C8102E] text-sm font-bold px-4 py-2 rounded-full border border-[#C8102E] hover:brightness-95 transition-all"
          >
            <span className="text-base leading-none">⊕</span>
            Create Claim
          </button>
        </div>

        {/* ── SKU table ── */}
        <div className="rounded-2xl overflow-hidden border border-[#E0DDB0]">

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-3">
            <span className="text-[#C8102E] text-xs font-bold">Name</span>
            <span className="text-[#C8102E] text-xs font-bold">Quantity</span>
            <span className="text-[#C8102E] text-xs font-bold">Price</span>
            <span className="text-[#C8102E] text-xs font-bold">GST</span>
            <span className="text-[#C8102E] text-xs font-bold">Total Price</span>
          </div>

          {/* Rows */}
          <div className="bg-[#FEFDE8] min-h-[400px]">
            {rows.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                No SKUs available.
              </p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.skuId}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#E0DDB0] items-center"
                >
                  <span className="text-sm text-gray-800">{row.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={row.quantity === 0 ? '' : row.quantity}
                    onChange={(e) => handleQuantityChange(row.skuId, e.target.value)}
                    placeholder="0"
                    className="w-16 bg-white border border-[#E0DDB0] rounded-lg px-2 py-1 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                  />
                  <span className="text-sm text-gray-800">₹{row.price}</span>
                  <span className="text-sm text-gray-800">{row.gst}%</span>
                  <span className="text-sm text-gray-800">
                    ₹{row.totalPrice.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ── Cancel / Release Purchase Order ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="text-[#C8102E] text-sm font-bold px-6 py-3 rounded-2xl border border-[#C8102E] hover:bg-[#C8102E]/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReleasePurchaseOrder}
            className="bg-[#C8102E] text-white text-sm font-bold px-6 py-3 rounded-full hover:brightness-90 transition-all"
          >
            Release Purchase Order
          </button>
        </div>

      </div>
    </AppLayout>
  )
}