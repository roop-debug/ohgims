import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
// --- END ---

interface SKURow {
  sku_id: string
  name: string
  price: number
  gst_rate: number
  quantity: number
}

export default function CreateOrder() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // --- ADDED fetch SKUs from Supabase ---
  const [items, setItems] = useState<SKURow[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSKUs()
  }, [])

  async function fetchSKUs() {
    const { data, error } = await supabase
      .from('skus')
      .select('sku_id, name, price, gst_rate')
      .eq('status', 'Active')

    if (!error && data) {
      setItems(data.map((row: any) => ({ ...row, quantity: 0 })))
    }
  }
  // --- END ---

  function handleQuantityChange(sku_id: string, value: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.sku_id === sku_id ? { ...item, quantity: Math.max(0, value) } : item
      )
    )
  }

  const selectedItems = items.filter((i) => i.quantity > 0)

  function calcTotal(item: SKURow) {
    const base = item.price * item.quantity
    const gst = (base * item.gst_rate) / 100
    return base + gst
  }

  const grandTotal = selectedItems.reduce((sum, item) => sum + calcTotal(item), 0)

  // --- ADDED handleReleasePO with Supabase insert ---
  async function handleReleasePO() {
    if (selectedItems.length === 0 || !profile?.distributor_id) return
    setSubmitting(true)

    // Generate PO ID
    const poId = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

    // 1. Insert purchase order
    const { error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_id: poId,
        distributor_id: profile.distributor_id,
        status: 'pending',
        eta: null,
      })

    if (poError) { console.error(poError); setSubmitting(false); return }

    // 2. Insert line items
    const lineItems = selectedItems.map((item) => ({
      po_id: poId,
      sku_id: item.sku_id,
      item_name: item.name,
      quantity: item.quantity,
      rate: item.price,
      gst: item.gst_rate,
      price: calcTotal(item),
    }))

    const { error: lineError } = await supabase
      .from('po_line_items')
      .insert(lineItems)

    if (lineError) { console.error(lineError); setSubmitting(false); return }

    setSubmitting(false)
    navigate('/distributor/orders')
  }
  // --- END ---

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Create Order</h1>
          <button
            onClick={() => navigate('/distributor/claims')}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            + Create Claim
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No SKUs available
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const base = item.price * item.quantity
                  const gst = (base * item.gst_rate) / 100
                  const total = base + gst
                  return (
                    <tr key={item.sku_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(item.sku_id, item.quantity - 1)}
                            className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >−</button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.sku_id, Number(e.target.value))}
                            className="w-14 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#E8400C]"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.sku_id, item.quantity + 1)}
                            className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-gray-700">{item.gst_rate}%</td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.quantity > 0 ? `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {selectedItems.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Grand Total</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => navigate('/distributor/orders')}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >Cancel</button>
          <button
            onClick={handleReleasePO}
            disabled={submitting || selectedItems.length === 0}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Releasing...' : 'Release Purchase Order'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}