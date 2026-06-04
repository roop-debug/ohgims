// src/app/distributor/OrderDetails.tsx

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import type { PurchaseOrder } from '../../types'

// ── Type for joined view (replace with Supabase join) ─────────────────────────
interface OrderItemRow {
  sr: number
  sku: string
  itemName: string
  quantity: number
  rate: number
  gst: number
  price: number
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query on order_items joined with skus filtered by poNo
// const MOCK_ITEMS: OrderItemRow[] = [
//   { sr: 1, sku: 'SKU-001', itemName: 'Product A', quantity: 10, rate: 100, gst: 18, price: 1180 },
//   { sr: 2, sku: 'SKU-002', itemName: 'Product B', quantity: 5,  rate: 200, gst: 18, price: 1180 },
// ]

// TODO: replace with Supabase query on purchase_orders filtered by poNo
// const MOCK_STATUS: PurchaseOrder['status'] = 'dispatched'

export default function DistributorOrderDetails() {
  const { poNo }  = useParams<{ poNo: string }>()
  const navigate  = useNavigate()

  // TODO: replace with Supabase query — order items + skus for poNo
  const [items] = useState<OrderItemRow[]>([])

  // TODO: replace with Supabase query — purchase_orders.status for poNo
  const [orderStatus] = useState<PurchaseOrder['status'] | null>(null)

  async function handleMarkDelivered() {
    if (!poNo) return
    // TODO: Supabase update — set purchase_orders.status = 'delivered' where id = poNo
    // TODO: Supabase update — set dispatch.status = 'delivered' where order_id = poNo
    // TODO: refetch / navigate back after update
    navigate('/distributor/orders')
  }

  return (
    <AppLayout>
      <div className="rounded-2xl overflow-hidden border border-[#C8102E]">

        {/* Red header */}
        <div className="bg-[#C8102E] px-5 py-4 flex items-center justify-between">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider">
            {poNo}
          </h2>
          <div className="flex items-center gap-3">
            {/* Mark Delivered — only visible when order is dispatched */}
            {orderStatus === 'dispatched' && (
              <button
                onClick={handleMarkDelivered}
                className="bg-[#FEFDE8] text-[#C8102E] text-xs font-bold px-4 py-1.5 rounded-full hover:brightness-95 transition-all"
              >
                Mark Delivered
              </button>
            )}
            <button
              onClick={() => navigate('/distributor/orders')}
              className="text-white text-lg leading-none hover:opacity-75 transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[50px_80px_2fr_80px_80px_70px_90px] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-2">
          <span className="text-[#C8102E] text-xs font-bold">Sr No.</span>
          <span className="text-[#C8102E] text-xs font-bold">SKU</span>
          <span className="text-[#C8102E] text-xs font-bold">Item Name</span>
          <span className="text-[#C8102E] text-xs font-bold">Quantity</span>
          <span className="text-[#C8102E] text-xs font-bold">Rate</span>
          <span className="text-[#C8102E] text-xs font-bold">GST</span>
          <span className="text-[#C8102E] text-xs font-bold">Price</span>
        </div>

        {/* Rows */}
        <div className="bg-[#FEFDE8] min-h-[400px]">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">
              No items found.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.sr}
                className="grid grid-cols-[50px_80px_2fr_80px_80px_70px_90px] px-4 py-3 border-b border-[#E0DDB0]"
              >
                <span className="text-sm text-gray-800">{item.sr}</span>
                <span className="text-sm text-gray-800">{item.sku}</span>
                <span className="text-sm text-gray-800">{item.itemName}</span>
                <span className="text-sm text-gray-800">{item.quantity}</span>
                <span className="text-sm text-gray-800">₹{item.rate}</span>
                <span className="text-sm text-gray-800">{item.gst}%</span>
                <span className="text-sm text-gray-800">₹{item.price.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

      </div>
    </AppLayout>
  )
}