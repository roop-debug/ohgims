import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
// --- END ---

interface SalesRow {
  id: string
  sku_id: string
  item_name: string
  units_sold: number
  selling_price: number
  total_revenue: number
  date: string
}

const initialForm = {
  sku_id: '',
  units_sold: '',
  selling_price: '',
  total_revenue: '',
}

export default function DistributorSales() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // --- ADDED data state, SKU list, and fetch ---
  const [data, setData] = useState<SalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [skuOptions, setSkuOptions] = useState<{ sku_id: string; name: string }[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.distributor_id) {
      fetchSales()
      fetchSKUs()
    }
  }, [profile])

  async function fetchSales() {
    const { data, error } = await supabase
      .from('sales_logs')
      .select('sales_id, sku_id, units_sold, selling_price, total_revenue, date, skus(name)')
      .eq('distributor_id', profile?.distributor_id)
      .order('date', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.sales_id,
        sku_id: row.sku_id,
        item_name: row.skus?.name,
        units_sold: row.units_sold,
        selling_price: row.selling_price,
        total_revenue: row.total_revenue,
        date: row.date,
      })))
    }
    setLoading(false)
  }

  async function fetchSKUs() {
    const { data, error } = await supabase
      .from('distributor_inventory')
      .select('sku_id, skus(name)')
      .eq('distributor_id', profile?.distributor_id)
      .gt('total_stock', 0)

    if (!error && data) {
      setSkuOptions(data.map((row: any) => ({
        sku_id: row.sku_id,
        name: row.skus?.name,
      })))
    }
  }
  // --- END ---

  function handleChange(key: keyof typeof initialForm, value: string) {
    const updated = { ...form, [key]: value }
    if (key === 'units_sold' || key === 'selling_price') {
      const units = parseInt(key === 'units_sold' ? value : form.units_sold) || 0
      const price = parseFloat(key === 'selling_price' ? value : form.selling_price) || 0
      updated.total_revenue = (units * price).toFixed(2)
    }
    setForm(updated)
  }

  function handleClose() {
    setModalOpen(false)
    setForm(initialForm)
    setError(null)
  }

  // --- ADDED handleSubmit with Supabase insert ---
  async function handleSubmit() {
  setError(null)
  if (!form.sku_id || !form.units_sold || !form.selling_price) {
    setError('Please fill all required fields')
    return
  }

  // --- ADDED stock validation ---
  const unitsSold = parseInt(form.units_sold)
  const { data: invData } = await supabase
    .from('distributor_inventory')
    .select('total_stock')
    .eq('distributor_id', profile?.distributor_id)
    .eq('sku_id', form.sku_id)
    .single()

  if (!invData || unitsSold > invData.total_stock) {
    setError(`Only ${invData?.total_stock ?? 0} units available in stock`)
    return
  }
  // --- END ---

  setSubmitting(true)

  const sellingPrice = parseFloat(form.selling_price)
  const totalRevenue = parseFloat(form.total_revenue)

  // 1. Insert sales log
  const { error: salesError } = await supabase
    .from('sales_logs')
    .insert({
      distributor_id: profile?.distributor_id,
      sku_id: form.sku_id,
      date: new Date().toISOString().split('T')[0],
      units_sold: unitsSold,
      selling_price: sellingPrice,
      total_revenue: totalRevenue,
    })

  if (salesError) { setError(salesError.message); setSubmitting(false); return }

  // 2. Update distributor inventory — decrease stock
  const { data: currentInv } = await supabase
    .from('distributor_inventory')
    .select('dist_inventory_id, stock_out, total_stock')
    .eq('distributor_id', profile?.distributor_id)
    .eq('sku_id', form.sku_id)
    .single()

  if (currentInv) {
    const newTotal = currentInv.total_stock - unitsSold
    await supabase
      .from('distributor_inventory')
      .update({
        stock_out: currentInv.stock_out + unitsSold,
        total_stock: newTotal,
        status: newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock',
        date: new Date().toISOString().split('T')[0],
      })
      .eq('dist_inventory_id', currentInv.dist_inventory_id)
  }

  setSubmitting(false)
  handleClose()
  fetchSales()
  fetchSKUs()
}
  // --- END ---

  const columns: ColumnDef<SalesRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'Items', accessorKey: 'item_name' },
    { header: "SKU's", accessorKey: 'sku_id' },
    { header: 'Units Sold', accessorKey: 'units_sold' },
    {
      header: 'Selling Price',
      accessorKey: 'selling_price',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
    {
      header: 'Total Revenue',
      accessorKey: 'total_revenue',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
  ]

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Sales</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/distributor/claims')}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >Create Claim</button>
            <button
              onClick={() => setModalOpen(true)}
              className="w-9 h-9 bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors flex items-center justify-center text-xl"
            >+</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="sales"
          todayToggle
          emptyMessage="No sales logged yet"
        />
      </div>

      <Modal open={modalOpen} title="Log Sale" onClose={handleClose}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>SKU</label>
            {/* --- ADDED populated SKU dropdown from distributor's in-stock inventory --- */}
            <select
              value={form.sku_id}
              onChange={(e) => handleChange('sku_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select SKU...</option>
              {skuOptions.map((s) => (
                <option key={s.sku_id} value={s.sku_id}>{s.name} ({s.sku_id})</option>
              ))}
            </select>
            {/* --- END --- */}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Units Sold</label>
              <input type="number" value={form.units_sold}
                onChange={(e) => handleChange('units_sold', e.target.value)}
                placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Selling Price (₹)</label>
              <input type="number" value={form.selling_price}
                onChange={(e) => handleChange('selling_price', e.target.value)}
                placeholder="0.00" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Total Revenue</label>
            <input type="number" value={form.total_revenue} readOnly
              className={`${inputClass} bg-gray-50 text-gray-500`} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={handleClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors disabled:opacity-50">
              {submitting ? 'Saving...' : 'Log Sale'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}