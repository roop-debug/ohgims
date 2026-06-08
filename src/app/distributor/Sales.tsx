import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

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

  const [data, setData] = useState<SalesRow[]>([])
  const [loading, setLoading] = useState(true)
  // --- UPDATED skuOptions to include pcs_per_unit ---
  const [skuOptions, setSkuOptions] = useState<{ sku_id: string; name: string; pcs_per_unit: number; total_stock: number }[]>([])
  // --- END ---
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
      // --- UPDATED to also fetch pcs_per_unit from skus ---
      .select('sku_id, total_stock, skus(name, pcs_per_unit)')
      // --- END ---
      .eq('distributor_id', profile?.distributor_id)
      .gt('total_stock', 0)

    if (!error && data) {
      setSkuOptions(data.map((row: any) => ({
        sku_id: row.sku_id,
        name: row.skus?.name,
        // --- ADDED ---
        pcs_per_unit: row.skus?.pcs_per_unit ?? 1,
        total_stock: row.total_stock, // in boxes
        // --- END ---
      })))
    }
  }

  // --- ADDED helper to get selected SKU's pcs_per_unit ---
  const selectedSKU = skuOptions.find(s => s.sku_id === form.sku_id)
  const pcsPerUnit = selectedSKU?.pcs_per_unit ?? 1
  const maxPcs = (selectedSKU?.total_stock ?? 0) * pcsPerUnit
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

  async function handleSubmit() {
    setError(null)
    if (!form.sku_id || !form.units_sold || !form.selling_price) {
      setError('Please fill all required fields')
      return
    }

    const unitsSold = parseInt(form.units_sold) // in pcs

    // --- UPDATED stock validation to check against pcs (boxes × pcs_per_unit) ---
    if (unitsSold > maxPcs) {
      setError(`Only ${maxPcs} pcs available in stock (${selectedSKU?.total_stock} boxes × ${pcsPerUnit} pcs/box)`)
      return
    }
    // --- END ---

    setSubmitting(true)

    const sellingPrice = parseFloat(form.selling_price)
    const totalRevenue = parseFloat(form.total_revenue)

    // 1. Insert sales log (units in pcs)
    const { error: salesError } = await supabase
      .from('sales_logs')
      .insert({
        distributor_id: profile?.distributor_id,
        sku_id: form.sku_id,
        date: new Date().toISOString().split('T')[0],
        units_sold: unitsSold, // pcs
        selling_price: sellingPrice,
        total_revenue: totalRevenue,
      })

    if (salesError) { setError(salesError.message); setSubmitting(false); return }

    // --- UPDATED inventory decrement — convert pcs to boxes ---
    const boxesDecremented = Math.ceil(unitsSold / pcsPerUnit)

    const { data: currentInv } = await supabase
      .from('distributor_inventory')
      .select('dist_inventory_id, stock_out, total_stock')
      .eq('distributor_id', profile?.distributor_id)
      .eq('sku_id', form.sku_id)
      .single()

    if (currentInv) {
      const newTotal = currentInv.total_stock - boxesDecremented
      await supabase
        .from('distributor_inventory')
        .update({
          stock_out: currentInv.stock_out + boxesDecremented,
          total_stock: newTotal,
          status: newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock',
          date: new Date().toISOString().split('T')[0],
        })
        .eq('dist_inventory_id', currentInv.dist_inventory_id)
    }
    // --- END ---

    setSubmitting(false)
    handleClose()
    fetchSales()
    fetchSKUs()
  }

  const columns: ColumnDef<SalesRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'Items', accessorKey: 'item_name' },
    { header: "SKU's", accessorKey: 'sku_id' },
    // --- UPDATED header to show pcs ---
    { header: 'Units Sold (pcs)', accessorKey: 'units_sold' },
    // --- END ---
    {
      header: 'Selling Price (per pc)',
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
            <select
              value={form.sku_id}
              onChange={(e) => handleChange('sku_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select SKU...</option>
              {skuOptions.map((s) => (
                // --- UPDATED to show pcs_per_unit and available stock in pcs ---
                <option key={s.sku_id} value={s.sku_id}>
                  {s.name} ({s.sku_id}) — {s.total_stock * s.pcs_per_unit} pcs available
                </option>
                // --- END ---
              ))}
            </select>
          </div>

          {/* --- ADDED pcs per box hint when SKU is selected --- */}
          {selectedSKU && (
            <p className="text-xs text-gray-400 -mt-2">
              1 box = {pcsPerUnit} pcs · {selectedSKU.total_stock} boxes in stock = {maxPcs} pcs total
            </p>
          )}
          {/* --- END --- */}

          <div className="grid grid-cols-2 gap-3">
            <div>
              {/* --- UPDATED label to show pcs --- */}
              <label className={labelClass}>Units Sold (pcs)</label>
              <div className="relative">
                <input
                  type="number"
                  value={form.units_sold}
                  onChange={(e) => handleChange('units_sold', e.target.value)}
                  placeholder="0"
                  className={`${inputClass} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">pcs</span>
              </div>
              {/* --- END --- */}
            </div>
            <div>
              {/* --- UPDATED label to show per pc --- */}
              <label className={labelClass}>Selling Price (₹/pc)</label>
              {/* --- END --- */}
              <input
                type="number"
                value={form.selling_price}
                onChange={(e) => handleChange('selling_price', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
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