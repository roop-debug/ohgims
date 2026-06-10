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

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchDistributors()
  }, [])

  // --- UPDATED fetchDistributors to normalize units ---
async function fetchDistributors() {
  setLoading(true)

  const { data: distributors } = await supabase
    .from('distributors')
    .select('*')
    .order('created_at', { ascending: false })

  if (!distributors) { setLoading(false); return }

  const enriched = await Promise.all(
    distributors.map(async (d) => {
      const [
        { data: salesData },
        { data: invData },
      ] = await Promise.all([
        supabase
          .from('sales_logs')
          .select('units_sold, total_revenue')
          .eq('distributor_id', d.distributor_id)
          .eq('date', today),

        supabase
          .from('distributor_inventory')
          .select('stock_in, skus(pcs_per_unit)')
          .eq('distributor_id', d.distributor_id),
      ])

      const soldPcs = salesData?.reduce((sum, s) => sum + s.units_sold, 0) ?? 0
      const revenue = salesData?.reduce((sum, s) => sum + s.total_revenue, 0) ?? 0

      // --- Convert stock_in (boxes) to pcs using pcs_per_unit ---
      const purchasedPcs = invData?.reduce((sum, r: any) => {
        const ppu = r.skus?.pcs_per_unit ?? 1
        return sum + (r.stock_in * ppu)
      }, 0) ?? 0
      // --- END ---

      return {
        ...d,
        purchased: purchasedPcs,
        sold: soldPcs,
        total: purchasedPcs - soldPcs,
        revenue,
      }
    })
  )

  setData(enriched)
  setLoading(false)
}
// --- END ---

  function handleChange(key: keyof typeof initialForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleRowClick(row: DistributorRow) {
    setSelectedDistributor(row)
    setDetailsModalOpen(true)
  }

  function handleClose() {
    setAddModalOpen(false)
    setForm(initialForm)
    setError(null)
    setShowPassword(false)
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-distributor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(form),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        setError(result.error ?? 'Something went wrong')
        setSubmitting(false)
        return
      }

      handleClose()
      fetchDistributors()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // KPI totals
  const totalDistributors = data.length
  const totalUnitsSold = data.reduce((sum, d) => sum + d.sold, 0)
  const totalUnitsBought = data.reduce((sum, d) => sum + d.purchased, 0)

  const columns: ColumnDef<DistributorRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    { header: 'Distributor', accessorKey: 'name' },
    { header: 'Purchased', accessorKey: 'purchased' },
    { header: 'Sold', accessorKey: 'sold' },
    { header: 'Total', accessorKey: 'total' },
    {
      header: 'Revenue',
      accessorKey: 'revenue',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
  ]

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eb2030]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KPICard label="No. of Distributors" value={loading ? '—' : totalDistributors} />
          <KPICard label="Total Units Sold" value={loading ? '—' : totalUnitsSold} />
          <KPICard label="Total Units Bought" value={loading ? '—' : totalUnitsBought} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Distributor Overview</h1>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
          >
            + Add Distributor
          </button>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="distributors"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No distributors found"
        />

      </div>

      {/* Add Distributor Modal */}
      <Modal open={addModalOpen} title="Add Distributor" onClose={handleClose}>
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
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-[#eb2030] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c4001a] transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? 'Creating...' : 'Add Distributor'}
          </button>
        </div>
      </Modal>

      {/* Distributor Details Modal */}
      <Modal
        open={detailsModalOpen}
        title={selectedDistributor?.name ?? 'Distributor Details'}
        onClose={() => { setDetailsModalOpen(false); setSelectedDistributor(null) }}
      >
        {selectedDistributor && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">POC Name</span>
                <span className="font-medium text-gray-900">{selectedDistributor.poc_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Contact</span>
                <span className="font-medium text-gray-900">{selectedDistributor.poc_contact}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{selectedDistributor.poc_email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST No</span>
                <span className="font-medium text-gray-900">{selectedDistributor.gst_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">FSSAI No</span>
                <span className="font-medium text-gray-900">{selectedDistributor.fssai_no}</span>
              </div>
              {selectedDistributor.location && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-gray-900">{selectedDistributor.location}</span>
                </div>
              )}
            </div>
            <hr className="border-gray-100" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Purchased</p>
                <p className="text-lg font-semibold text-gray-900">{selectedDistributor.purchased}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Sold</p>
                <p className="text-lg font-semibold text-gray-900">{selectedDistributor.sold}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">{selectedDistributor.total}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-lg font-semibold text-gray-900">₹{selectedDistributor.revenue.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </AppLayout>
  )
}