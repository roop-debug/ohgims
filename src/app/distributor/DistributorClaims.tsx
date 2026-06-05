import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
// --- END ---

interface ClaimRow {
  id: string
  claim_id: string
  claim_type: string
  reimbursement_amt: number
  status: 'pending' | 'approved' | 'declined'
}

const initialForm = {
  sku_id: '',
  rate: '',
  selling_rate: '',
  units: '',
  reimbursement_amt: '',
  claim_type: '' as 'Price Difference' | 'Damage' | 'Expiry' | 'Other' | '',
  reason: '',
}

export default function DistributorClaims() {
  const { profile } = useAuth()

  // --- ADDED data state and fetch ---
  const [data, setData] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [skuOptions, setSkuOptions] = useState<{ sku_id: string; name: string }[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)

  useEffect(() => {
    if (profile?.distributor_id) {
      fetchClaims()
      fetchSKUs()
    }
  }, [profile])

  async function fetchClaims() {
    const { data, error } = await supabase
      .from('claims')
      .select('claim_id, claim_type, reimbursement_amt, status')
      .eq('distributor_id', profile?.distributor_id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.claim_id,
        claim_id: row.claim_id,
        claim_type: row.claim_type,
        reimbursement_amt: row.reimbursement_amt,
        status: row.status,
      })))
    }
    setLoading(false)
  }

  async function fetchSKUs() {
    const { data, error } = await supabase
      .from('skus')
      .select('sku_id, name')
      .eq('status', 'Active')

    if (!error && data) {
      setSkuOptions(data.map((row: any) => ({ sku_id: row.sku_id, name: row.name })))
    }
  }
  // --- END ---

  function handleChange(key: keyof typeof initialForm, value: string) {
    const updated = { ...form, [key]: value }
    if (key === 'rate' || key === 'selling_rate' || key === 'units') {
      const rate = parseFloat(key === 'rate' ? value : form.rate) || 0
      const sellingRate = parseFloat(key === 'selling_rate' ? value : form.selling_rate) || 0
      const units = parseInt(key === 'units' ? value : form.units) || 0
      const reimbursement = (rate - sellingRate) * units
      updated.reimbursement_amt = reimbursement > 0 ? reimbursement.toFixed(2) : '0'
    }
    setForm(updated)
  }

  function handleRowClick(row: ClaimRow) {
    setSelectedClaim(row)
    setDetailsModalOpen(true)
  }

  function handleCloseCreate() {
    setCreateModalOpen(false)
    setForm(initialForm)
    setError(null)
    setInvoiceFile(null)
  }

  // --- ADDED handleSubmit with Supabase insert + storage upload ---
  async function handleSubmit() {
    setError(null)
    if (!form.sku_id || !form.selling_rate || !form.units || !form.claim_type) {
      setError('Please fill all required fields')
      return
    }
    setSubmitting(true)

    // 1. Upload invoice if provided
    let invoiceUrl = ''
    if (invoiceFile) {
      const filePath = `${profile?.id}/${Date.now()}_${invoiceFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('claim-invoices')
        .upload(filePath, invoiceFile)

      if (uploadError) { setError(uploadError.message); setSubmitting(false); return }
      invoiceUrl = filePath
    }

    // 2. Generate claim ID
    const claimId = `CLM-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

    // 3. Insert claim
    const { error: claimError } = await supabase
      .from('claims')
      .insert({
        claim_id: claimId,
        distributor_id: profile?.distributor_id,
        sku_id: form.sku_id,
        claim_type: form.claim_type,
        rate: parseFloat(form.rate) || 0,
        selling_rate: parseFloat(form.selling_rate),
        units: parseInt(form.units),
        reimbursement_amt: parseFloat(form.reimbursement_amt) || 0,
        reason: form.reason,
        invoice_url: invoiceUrl,
        status: 'pending',
      })

    if (claimError) { setError(claimError.message); setSubmitting(false); return }

    setSubmitting(false)
    handleCloseCreate()
    fetchClaims()
  }
  // --- END ---

  const columns: ColumnDef<ClaimRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'Claim ID', accessorKey: 'claim_id' },
    {
      header: 'Claim Amount',
      accessorKey: 'reimbursement_amt',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
    { header: 'Claim Type', accessorKey: 'claim_type' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
  ]

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Claims</h1>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >+ Create Claim</button>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="claims"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No claims found"
        />
      </div>

      {/* Create Claim Modal */}
      <Modal open={createModalOpen} title="Create Claim" onClose={handleCloseCreate}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Invoice</label>
            <label className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors cursor-pointer">
              {invoiceFile ? invoiceFile.name : 'Upload Invoice'}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div>
            <label className={labelClass}>SKU</label>
            {/* --- ADDED populated SKU dropdown --- */}
            <select value={form.sku_id} onChange={(e) => handleChange('sku_id', e.target.value)} className={inputClass}>
              <option value="">Select SKU...</option>
              {skuOptions.map((s) => (
                <option key={s.sku_id} value={s.sku_id}>{s.name} ({s.sku_id})</option>
              ))}
            </select>
            {/* --- END --- */}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Rate</label>
              <input type="number" value={form.rate}
                onChange={(e) => handleChange('rate', e.target.value)}
                placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Selling Rate</label>
              <input type="number" value={form.selling_rate}
                onChange={(e) => handleChange('selling_rate', e.target.value)}
                placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Units</label>
              <input type="number" value={form.units}
                onChange={(e) => handleChange('units', e.target.value)}
                placeholder="0" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Reimbursement Amount</label>
              <input type="number" value={form.reimbursement_amt} readOnly
                className={`${inputClass} bg-gray-50 text-gray-500`} />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              {/* --- UPDATED claim types to match DB enum --- */}
              <select value={form.claim_type}
                onChange={(e) => handleChange('claim_type', e.target.value)} className={inputClass}>
                <option value="">Select type...</option>
                <option value="Price Difference">Price Difference</option>
                <option value="Damage">Damage</option>
                <option value="Expiry">Expiry</option>
                <option value="Other">Other</option>
              </select>
              {/* --- END --- */}
            </div>
          </div>

          <div>
            <label className={labelClass}>Reason</label>
            <textarea value={form.reason} onChange={(e) => handleChange('reason', e.target.value)}
              placeholder="Reason for claim..." rows={3} className={inputClass} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={handleCloseCreate}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Claim Details Modal */}
      <Modal
        open={detailsModalOpen}
        title={selectedClaim ? `Claim — ${selectedClaim.claim_id}` : 'Claim Details'}
        onClose={() => { setDetailsModalOpen(false); setSelectedClaim(null) }}
      >
        {selectedClaim && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Claim ID</p>
                <p className="text-sm font-medium text-gray-900">{selectedClaim.claim_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={selectedClaim.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Claim Type</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{selectedClaim.claim_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reimbursement Amount</p>
                <p className="text-sm font-medium text-gray-900">
                  ₹{selectedClaim.reimbursement_amt.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}