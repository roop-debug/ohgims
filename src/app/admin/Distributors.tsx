import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import KPICard from '../../components/shared/KPICard'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'

interface DistributorRow {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  billing_address: string
  shipping_address: string
  gst_no: string
  fssai_no: string
  location: string
  purchased: number
  sold: number
  total: number
  revenue: number
}

export default function AdminDistributors() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorRow | null>(null)

  // Add Distributor form state
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  // --- ADDED new form fields ---
  const [newBillingAddress, setNewBillingAddress] = useState('')
  const [newShippingAddress, setNewShippingAddress] = useState('')
  const [newGST, setNewGST] = useState('')
  const [newFSSAI, setNewFSSAI] = useState('')
  const [newLocation, setNewLocation] = useState('')
  // --- END ---

  // --- ADDED data state and fetch ---
  const [data, setData] = useState<DistributorRow[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchDistributors() {
    const { data, error } = await supabase
      .from('distributors')
      .select(`
        distributor_id,
        name,
        poc_name,
        poc_contact,
        poc_email,
        billing_address,
        shipping_address,
        gst_no,
        fssai_no,
        location,
        sales_logs (units_sold, total_revenue),
        distributor_inventory (stock_in, stock_out, total_stock)
      `)

    if (!error && data) {
      setData(data.map((row: any) => {
        const purchased = (row.distributor_inventory ?? []).reduce((s: number, r: any) => s + (r.stock_in ?? 0), 0)
        const sold = (row.sales_logs ?? []).reduce((s: number, r: any) => s + (r.units_sold ?? 0), 0)
        const revenue = (row.sales_logs ?? []).reduce((s: number, r: any) => s + (r.total_revenue ?? 0), 0)
        return {
          id: row.distributor_id,
          name: row.name,
          contact_person: row.poc_name,
          phone: row.poc_contact,
          email: row.poc_email,
          billing_address: row.billing_address,
          shipping_address: row.shipping_address,
          gst_no: row.gst_no,
          fssai_no: row.fssai_no,
          location: row.location,
          purchased,
          sold,
          total: purchased - sold,
          revenue,
        }
      }))
    }
    setLoading(false)
  }

  useEffect(() => { fetchDistributors() }, [])
  // --- END ---

  // --- UPDATED handleAddDistributor - now creates distributor_inventory rows for every SKU ---
async function handleAddDistributor() {
  if (!newName || !newContact || !newPhone || !newEmail || !newBillingAddress || !newShippingAddress || !newGST || !newFSSAI) return

  // 1. Insert distributor
  const { data: distData, error: distError } = await supabase
    .from('distributors')
    .insert({
      name: newName,
      poc_name: newContact,
      poc_contact: newPhone,
      poc_email: newEmail,
      billing_address: newBillingAddress,
      shipping_address: newShippingAddress,
      gst_no: newGST,
      fssai_no: newFSSAI,
      location: newLocation,
    })
    .select()
    .single()

  if (distError) { console.error(distError); return }

  // 2. Fetch all SKUs
  const { data: skus, error: skuError } = await supabase
    .from('skus')
    .select('sku_id')

  if (skuError) { console.error(skuError); return }

  // 3. Create a distributor_inventory row for every SKU
  if (skus && skus.length > 0) {
    const inventoryRows = skus.map((sku: any) => ({
      distributor_id: distData.distributor_id,
      sku_id: sku.sku_id,
      date: new Date().toISOString().split('T')[0],
      stock_in: 0,
      stock_out: 0,
      total_stock: 0,
      status: 'Out of Stock',
    }))

    const { error: invError } = await supabase
      .from('distributor_inventory')
      .insert(inventoryRows)

    if (invError) { console.error(invError); return }
  }

  setNewName('')
  setNewContact('')
  setNewPhone('')
  setNewEmail('')
  setNewBillingAddress('')
  setNewShippingAddress('')
  setNewGST('')
  setNewFSSAI('')
  setNewLocation('')
  setAddModalOpen(false)
  fetchDistributors()
}
// --- END ---

  function handleRowClick(row: DistributorRow) {
    setSelectedDistributor(row)
    setDetailsModalOpen(true)
  }

  // --- ADDED KPI values ---
  const totalDistributors = data.length
  const totalUnitsSold = data.reduce((s, r) => s + r.sold, 0)
  const totalUnitsBought = data.reduce((s, r) => s + r.purchased, 0)
  // --- END ---

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

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* --- UPDATED KPI values --- */}
          <KPICard label="No. of Distributors" value={totalDistributors.toString()} />
          <KPICard label="Total Units Sold" value={totalUnitsSold.toString()} />
          <KPICard label="Total Units Bought" value={totalUnitsBought.toString()} />
          {/* --- END --- */}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Distributor Overview</h1>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            + Add Distributor
          </button>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          searchable
          exportable
          exportFilename="distributors"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No distributors found"
        />

      </div>

      {/* Add Distributor Modal */}
      <Modal
        open={addModalOpen}
        title="Add Distributor"
        onClose={() => setAddModalOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. ABC Distributors"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input value={newContact} onChange={(e) => setNewContact(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. john@abc.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          {/* --- ADDED new form fields --- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <textarea value={newBillingAddress} onChange={(e) => setNewBillingAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Mumbai"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
            <textarea value={newShippingAddress} onChange={(e) => setNewShippingAddress(e.target.value)}
              placeholder="e.g. 456 Warehouse Rd, Mumbai"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST No.</label>
            <input value={newGST} onChange={(e) => setNewGST(e.target.value)}
              placeholder="e.g. 27AAPFU0939F1ZV"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FSSAI No.</label>
            <input value={newFSSAI} onChange={(e) => setNewFSSAI(e.target.value)}
              placeholder="e.g. 10012345000123"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g. Mumbai, Maharashtra"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]" />
          </div>
          {/* --- END --- */}
          <button
            onClick={handleAddDistributor}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2"
          >
            Add Distributor
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

            {/* Contact info */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Contact Person</span>
                <span className="font-medium text-gray-900">{selectedDistributor.contact_person}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-900">{selectedDistributor.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{selectedDistributor.email}</span>
              </div>
              {/* --- ADDED extra details --- */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-900">{selectedDistributor.location || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST No.</span>
                <span className="font-medium text-gray-900">{selectedDistributor.gst_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">FSSAI No.</span>
                <span className="font-medium text-gray-900">{selectedDistributor.fssai_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Billing Address</span>
                <span className="font-medium text-gray-900 text-right max-w-[60%]">{selectedDistributor.billing_address}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping Address</span>
                <span className="font-medium text-gray-900 text-right max-w-[60%]">{selectedDistributor.shipping_address}</span>
              </div>
              {/* --- END --- */}
            </div>

            <hr className="border-gray-100" />

            {/* Stats */}
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
                <p className="text-lg font-semibold text-gray-900">
                  ₹{selectedDistributor.revenue.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

          </div>
        )}
      </Modal>

    </AppLayout>
  )
}