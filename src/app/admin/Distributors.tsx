import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import KPICard from '../../components/shared/KPICard'
import { supabase } from '../../lib/supabase'
import type { ColumnDef } from '@tanstack/react-table'

interface DistributorRow {
  distributor_id: string
  name: string
  poc_name: string
  poc_contact: string
  poc_email: string
  billing_address: string
  shipping_address: string
  gst_no: string
  fssai_no: string
  location: string | null
  purchased: number
  sold: number
  total: number
  revenue: number
}

interface SKURow {
  sku_id: string
  name: string
  price: number
  gst_rate: number
  pcs_per_unit: number
  quantity: number
}

const initialForm = {
  name: '',
  poc_name: '',
  poc_contact: '',
  poc_email: '',
  billing_address: '',
  shipping_address: '',
  gst_no: '',
  fssai_no: '',
  location: '',
  password: '',
}

export default function AdminDistributors() {
  const [data, setData] = useState<DistributorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step management — 1: distributor details, 2: initial order
  const [step, setStep] = useState<1 | 2>(1)
  const [skus, setSkus] = useState<SKURow[]>([])
  const [skusLoading, setSkusLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchDistributors() }, [])

  async function fetchDistributors() {
    setLoading(true)
    const { data: distributors } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: false })

    if (!distributors) { setLoading(false); return }

    const enriched = await Promise.all(
      distributors.map(async (d) => {
        const [{ data: salesData }, { data: invData }] = await Promise.all([
          supabase.from('sales_logs').select('units_sold, total_revenue').eq('distributor_id', d.distributor_id).eq('date', today),
          supabase.from('distributor_inventory').select('stock_in, skus(pcs_per_unit)').eq('distributor_id', d.distributor_id),
        ])

        const soldPcs = salesData?.reduce((sum, s) => sum + s.units_sold, 0) ?? 0
        const revenue = salesData?.reduce((sum, s) => sum + s.total_revenue, 0) ?? 0
        const purchasedPcs = invData?.reduce((sum, r: any) => {
          const ppu = r.skus?.pcs_per_unit ?? 1
          return sum + (r.stock_in * ppu)
        }, 0) ?? 0

        return { ...d, purchased: purchasedPcs, sold: soldPcs, total: purchasedPcs - soldPcs, revenue }
      })
    )

    setData(enriched)
    setLoading(false)
  }

  async function fetchSKUs() {
    setSkusLoading(true)
    const { data, error } = await supabase
      .from('skus')
      .select('sku_id, name, price, gst_rate, pcs_per_unit')
      .eq('status', 'Active')

    if (!error && data) {
      setSkus(data.map((row: any) => ({ ...row, quantity: 0 })))
    }
    setSkusLoading(false)
  }

  function handleChange(key: keyof typeof initialForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleQuantityChange(sku_id: string, value: number) {
    setSkus((prev) => prev.map((s) => s.sku_id === sku_id ? { ...s, quantity: Math.max(0, value) } : s))
  }

  function calcTotal(item: SKURow) {
    const base = item.price * item.pcs_per_unit * item.quantity
    const gst = (base * item.gst_rate) / 100
    return base + gst
  }

  const selectedItems = skus.filter((s) => s.quantity > 0)
  const grandTotal = selectedItems.reduce((sum, item) => sum + calcTotal(item), 0)

  function handleRowClick(row: DistributorRow) {
    setSelectedDistributor(row)
    setDetailsModalOpen(true)
  }

  function handleClose() {
    setAddModalOpen(false)
    setForm(initialForm)
    setError(null)
    setShowPassword(false)
    setStep(1)
    setSkus([])
  }

  async function handleNextStep() {
    // Validate step 1 fields
    const required = ['name', 'poc_name', 'poc_contact', 'poc_email', 'billing_address', 'shipping_address', 'gst_no', 'fssai_no', 'password'] as const
    for (const key of required) {
      if (!form[key].trim()) {
        setError(`${key.replace('_', ' ')} is required`)
        return
      }
    }
    setError(null)
    setSubmitting(true)
    await fetchSKUs()
    setSubmitting(false)
    setStep(2)
  }

  async function handleSubmit() {
    if (selectedItems.length === 0) {
      setError('Please add at least one SKU to the initial order')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      // Step 1 — Create distributor via Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-distributor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify(form),
        }
      )

      const result = await res.json()
      if (!res.ok) { setError(result.error ?? 'Something went wrong'); setSubmitting(false); return }

      const distributorId = result.distributor_id

      // Step 2 — Create initial PO
      const poId = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

      const { error: poError } = await supabase
        .from('purchase_orders')
        .insert({ po_id: poId, distributor_id: distributorId, status: 'approved', eta: null })

      if (poError) { setError(poError.message); setSubmitting(false); return }

      // Step 3 — Insert line items
      const lineItems = selectedItems.map((item) => ({
        po_id: poId,
        sku_id: item.sku_id,
        item_name: item.name,
        quantity: item.quantity,
        rate: item.price * item.pcs_per_unit,
        gst: item.gst_rate,
        price: calcTotal(item),
      }))

      const { error: lineError } = await supabase.from('po_line_items').insert(lineItems)
      if (lineError) { setError(lineError.message); setSubmitting(false); return }

      // Step 4 — Create dispatch entry as pending
      const { error: dispatchError } = await supabase
        .from('dispatches')
        .insert({ po_id: poId, distributor_id: distributorId, dispatched_at: new Date().toISOString(), eta: null, status: 'pending' })

      if (dispatchError) { setError(dispatchError.message); setSubmitting(false); return }

      // Step 5 — Deduct from master inventory
      for (const item of selectedItems) {
        const { data: currentInv } = await supabase
          .from('master_inventory')
          .select('inventory_id, stock_out, total_stock')
          .eq('sku_id', item.sku_id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (currentInv) {
          const newTotal = Math.max(0, currentInv.total_stock - item.quantity)
          await supabase
            .from('master_inventory')
            .update({
              stock_out: currentInv.stock_out + item.quantity,
              total_stock: newTotal,
              status: newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock',
              date: new Date().toISOString().split('T')[0],
            })
            .eq('inventory_id', currentInv.inventory_id)

          // Trigger low stock notification if needed
          if (newTotal <= 10) {
            await supabase.functions.invoke('notify-low-stock', { body: {} })
          }
        }
      }

      // Step 6 — Initialize distributor inventory for all SKUs (all at 0, updated on delivery)
const { data: allSkus } = await supabase.from('skus').select('sku_id')
if (allSkus) {
  const distInvRows = allSkus.map((s: any) => ({
    distributor_id: distributorId,
    sku_id: s.sku_id,
    date: today,
    stock_in: 0,
    stock_out: 0,
    total_stock: 0,
    status: 'Out of Stock',
  }))
  await supabase.from('distributor_inventory').insert(distInvRows)
}

      // Step 7 — Notify admins of new order
      await supabase.functions.invoke('notify-new-order', {
        body: { order_id: poId, distributor_name: form.name }
      })

      handleClose()
      fetchDistributors()

    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const totalDistributors = data.length
  const totalUnitsSold = data.reduce((sum, d) => sum + d.sold, 0)
  const totalUnitsBought = data.reduce((sum, d) => sum + d.purchased, 0)

  const columns: ColumnDef<DistributorRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    { header: 'Distributor', accessorKey: 'name' },
    { header: 'Purchased', accessorKey: 'purchased' },
    { header: 'Sold', accessorKey: 'sold' },
    { header: 'Total', accessorKey: 'total' },
    { header: 'Revenue', accessorKey: 'revenue', cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}` },
  ]

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eb2030]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KPICard label="No. of Distributors" value={loading ? '—' : totalDistributors} />
          <KPICard label="Total pcs Sold" value={loading ? '—' : totalUnitsSold} />
          <KPICard label="Total pcs Bought" value={loading ? '—' : totalUnitsBought} />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Distributor Overview</h1>
          <button onClick={() => setAddModalOpen(true)} className="px-4 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors">
            + Add Distributor
          </button>
        </div>

        <DataTable columns={columns} data={data} loading={loading} searchable exportable exportFilename="distributors" todayToggle onRowClick={handleRowClick} emptyMessage="No distributors found" />
      </div>

      {/* Add Distributor Modal */}
      <Modal
        open={addModalOpen}
        title={step === 1 ? 'Add Distributor — Details' : 'Add Distributor — Initial Order'}
        onClose={handleClose}
      >
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Business Name</label>
              <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="e.g. ABC Distributors" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>POC Name</label>
                <input value={form.poc_name} onChange={(e) => handleChange('poc_name', e.target.value)} placeholder="Contact person name" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>POC Contact</label>
                <input value={form.poc_contact} onChange={(e) => handleChange('poc_contact', e.target.value)} placeholder="e.g. 9876543210" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>POC Email</label>
              <p className="text-xs text-gray-400 mb-1">This email will be used as the distributor's login credentials.</p>
              <input type="email" value={form.poc_email} onChange={(e) => handleChange('poc_email', e.target.value)} placeholder="e.g. contact@abc.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Billing Address</label>
              <textarea value={form.billing_address} onChange={(e) => handleChange('billing_address', e.target.value)} placeholder="Full billing address" rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Shipping Address</label>
              <textarea value={form.shipping_address} onChange={(e) => handleChange('shipping_address', e.target.value)} placeholder="Full shipping address" rows={2} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>GST No</label>
                <input value={form.gst_no} onChange={(e) => handleChange('gst_no', e.target.value)} placeholder="e.g. 27AAPFU0939F1ZV" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>FSSAI No</label>
                <input value={form.fssai_no} onChange={(e) => handleChange('fssai_no', e.target.value)} placeholder="e.g. 10016011002763" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Location <span className="text-gray-400">(optional)</span></label>
              <input value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder="e.g. Mumbai" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Set login password"
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleNextStep} disabled={submitting} className="w-full bg-[#eb2030] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c4001a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {submitting ? 'Loading...' : 'Next — Add Initial Order →'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">Add the initial order for <span className="font-medium text-gray-900">{form.name}</span>. At least one SKU is required.</p>

            {skusLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty (boxes)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Box</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {skus.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No active SKUs</td></tr>
                    ) : skus.map((item) => {
                      const pricePerBox = item.price * item.pcs_per_unit
                      const base = pricePerBox * item.quantity
                      const gst = (base * item.gst_rate) / 100
                      const total = base + gst
                      return (
                        <tr key={item.sku_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-900">
                            {item.name}
                            <span className="block text-xs text-gray-400">{item.pcs_per_unit} pcs/box</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleQuantityChange(item.sku_id, item.quantity - 1)} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100">−</button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.sku_id, Number(e.target.value))}
                                className="w-14 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#eb2030]"
                              />
                              <button onClick={() => handleQuantityChange(item.sku_id, item.quantity + 1)} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100">+</button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">₹{pricePerBox.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-gray-700">{item.gst_rate}%</td>
                          <td className="px-4 py-3 text-gray-700">{item.quantity > 0 ? `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {selectedItems.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Grand Total</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 mt-2">
              <button onClick={() => { setStep(1); setError(null) }} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting || selectedItems.length === 0} className="flex-1 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Distributor & Release PO'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Distributor Details Modal */}
      <Modal open={detailsModalOpen} title={selectedDistributor?.name ?? 'Distributor Details'} onClose={() => { setDetailsModalOpen(false); setSelectedDistributor(null) }}>
        {selectedDistributor && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">POC Name</span><span className="font-medium text-gray-900">{selectedDistributor.poc_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Contact</span><span className="font-medium text-gray-900">{selectedDistributor.poc_contact}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{selectedDistributor.poc_email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">GST No</span><span className="font-medium text-gray-900">{selectedDistributor.gst_no}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">FSSAI No</span><span className="font-medium text-gray-900">{selectedDistributor.fssai_no}</span></div>
              {selectedDistributor.location && <div className="flex justify-between text-sm"><span className="text-gray-500">Location</span><span className="font-medium text-gray-900">{selectedDistributor.location}</span></div>}
            </div>
            <hr className="border-gray-100" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Purchased</p><p className="text-lg font-semibold text-gray-900">{selectedDistributor.purchased}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Sold</p><p className="text-lg font-semibold text-gray-900">{selectedDistributor.sold}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-semibold text-gray-900">{selectedDistributor.total}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Revenue</p><p className="text-lg font-semibold text-gray-900">₹{selectedDistributor.revenue.toLocaleString('en-IN')}</p></div>
            </div>
          </div>
        )}
      </Modal>

    </AppLayout>
  )
}