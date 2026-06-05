import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import type { ColumnDef } from '@tanstack/react-table'

interface SalesRow {
  id: string
  sku_id: string
  item_name: string
  units_sold: number
  selling_price: number
  total_revenue: number
  date: string
}

const data: SalesRow[] = []

const initialForm = {
  sku_id: '',
  units_sold: '',
  selling_price: '',
  total_revenue: '',
}

export default function DistributorSales() {
  const navigate = useNavigate()
  const [loading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(key: keyof typeof initialForm, value: string) {
    const updated = { ...form, [key]: value }

    // Auto-calc total revenue
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
    setSubmitting(true)
    // TODO: Supabase insert after DB setup
    setSubmitting(false)
    handleClose()
  }

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

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Sales</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/distributor/claims')}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Create Claim
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="w-9 h-9 bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors flex items-center justify-center text-xl"
            >
              +
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
          exportFilename="sales"
          todayToggle
          emptyMessage="No sales logged yet"
        />

      </div>

      {/* Log Sale Modal */}
      <Modal
        open={modalOpen}
        title="Log Sale"
        onClose={handleClose}
      >
        <div className="flex flex-col gap-4">

          {/* SKU */}
          <div>
            <label className={labelClass}>SKU</label>
            <select
              value={form.sku_id}
              onChange={(e) => handleChange('sku_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select SKU...</option>
              {/* populated from Supabase after DB setup */}
            </select>
          </div>

          {/* Units Sold + Selling Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Units Sold</label>
              <input
                type="number"
                value={form.units_sold}
                onChange={(e) => handleChange('units_sold', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Selling Price (₹)</label>
              <input
                type="number"
                value={form.selling_price}
                onChange={(e) => handleChange('selling_price', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </div>

          {/* Total Revenue — auto calculated */}
          <div>
            <label className={labelClass}>Total Revenue</label>
            <input
              type="number"
              value={form.total_revenue}
              readOnly
              className={`${inputClass} bg-gray-50 text-gray-500`}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Log Sale'}
            </button>
          </div>

        </div>
      </Modal>

    </AppLayout>
  )
}