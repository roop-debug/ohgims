// src/app/distributor/OrderDetails.tsx

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import StatusBadge from '../../components/shared/StatusBadge'
import { supabase } from '../../lib/supabase'

interface OrderItemRow {
  sr: number
  sku: string
  itemName: string
  quantity: number
  rate: number
  gst: number
  price: number
}

interface OrderInfo {
  po_id: string
  created_at: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
  eta: string | null
  cancellation_reason: string | null
  distributor_name: string
}

export default function DistributorOrderDetails() {
  const { poNo } = useParams<{ poNo: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (poNo) fetchOrderDetails()
  }, [poNo])

  async function fetchOrderDetails() {
    const { data: orderData, error: orderError } = await supabase
      .from('purchase_orders')
      .select('po_id, created_at, status, eta, cancellation_reason, distributors(name)')
      .eq('po_id', poNo)
      .single()

    if (orderError) { console.error(orderError); setLoading(false); return }

    setOrder({
      po_id: orderData.po_id,
      created_at: orderData.created_at,
      status: orderData.status,
      eta: orderData.eta,
      cancellation_reason: orderData.cancellation_reason,
      distributor_name: (orderData.distributors as any)?.name ?? '—',
    })

    const { data: lineItems, error: lineError } = await supabase
      .from('po_line_items')
      .select('line_id, sku_id, item_name, quantity, rate, gst, price')
      .eq('po_id', poNo)

    if (!lineError && lineItems) {
      setItems(lineItems.map((row: any, index: number) => ({
        sr: index + 1,
        sku: row.sku_id,
        itemName: row.item_name,
        quantity: row.quantity,
        rate: row.rate,
        gst: row.gst,
        price: row.price,
      })))
    }

    setLoading(false)
  }

  const grandTotal = items.reduce((sum, item) => sum + item.price, 0)

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Purchase Order</p>
            <h1 className="text-lg font-semibold text-gray-900">{poNo}</h1>
          </div>
          <button
            onClick={() => navigate('/distributor/orders')}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Orders
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>
        ) : !order ? (
          <p className="text-sm text-gray-400 py-8 text-center">Order not found.</p>
        ) : (
          <>
            {/* Order meta */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Status</p>
                <StatusBadge status={order.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(order.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">ETA</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.eta ? new Date(order.eta).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Distributor</p>
                <p className="text-sm font-medium text-gray-900">{order.distributor_name}</p>
              </div>
            </div>

            {/* Cancellation reason */}
            {order.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Cancellation Reason</p>
                <p className="text-sm text-red-700">{order.cancellation_reason || '—'}</p>
              </div>
            )}

            {/* Line items table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Line Items</p>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[40px_80px_2fr_70px_80px_60px_90px] bg-gray-50 border-b border-gray-100 px-4 py-2">
                <span className="text-xs font-semibold text-gray-500">Sr.</span>
                <span className="text-xs font-semibold text-gray-500">SKU</span>
                <span className="text-xs font-semibold text-gray-500">Item Name</span>
                <span className="text-xs font-semibold text-gray-500">Qty</span>
                <span className="text-xs font-semibold text-gray-500">Rate</span>
                <span className="text-xs font-semibold text-gray-500">GST</span>
                <span className="text-xs font-semibold text-gray-500">Price</span>
              </div>

              {/* Table rows */}
              {items.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">No items found.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.sr}
                    className="grid grid-cols-[40px_80px_2fr_70px_80px_60px_90px] px-4 py-3 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm text-gray-700">{item.sr}</span>
                    <span className="text-sm text-gray-700">{item.sku}</span>
                    <span className="text-sm text-gray-700">{item.itemName}</span>
                    <span className="text-sm text-gray-700">{item.quantity}</span>
                    <span className="text-sm text-gray-700">₹{item.rate.toLocaleString('en-IN')}</span>
                    <span className="text-sm text-gray-700">{item.gst}%</span>
                    <span className="text-sm text-gray-700">₹{item.price.toLocaleString('en-IN')}</span>
                  </div>
                ))
              )}

              {/* Grand total */}
              {items.length > 0 && (
                <div className="flex justify-end px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">
                    Grand Total: ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}