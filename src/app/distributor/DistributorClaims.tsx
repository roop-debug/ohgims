import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface ClaimRow {
  id: string
  claim_id: string
  claim_type: 'sale' | 'reimbursement'
  reimbursement_amt: number
  status: 'pending' | 'approved' | 'declined'
}

const data: ClaimRow[] = []

const initialForm = {
  sku_id: '',
  rate: '',
  selling_rate: '',
  units: '',
  reimbursement_amt: '',
  claim_type: '' as 'sale' | 'reimbursement' | '',
  reason: '',
  invoice_url: '',
}

export default function DistributorClaims() {
  const [loading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)

  function handleChange(key: keyof typeof initialForm, value: string) {
    const updated = { ...form, [key]: value }

    // Auto-calc reimbursement amount
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

  async function handleSubmit() {
    setError(null)
    if (!form.sku_id || !form.selling_rate || !form.units || !form.claim_type) {
      setError('Please fill all required fields')
      return
    }
    setSubmitting(true)
    // TODO: Supabase insert after DB setup
    setSubmitting(false)
    handleCloseCreate()
  }

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

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Claims</h1>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            + Create Claim
          </button>
        </div>

        {/* Table */}
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
      <Modal
        open={createModalOpen}
        title="Create Claim"
        onClose={handleCloseCreate}
      >
        <div className="flex flex-col gap-4">

          {/* Invoice upload */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Invoice</label>
            <label className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors cursor-pointer">
              {invoiceFile ? invoiceFile.name : 'Upload Invoice'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

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

          {/* Rate, Selling Rate, Units */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Rate</label>
              <input
                type="number"
                value={form.rate}
                onChange={(e) => handleChange('rate', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Selling Rate</label>
              <input
                type="number"
                value={form.selling_rate}
                onChange={(e) => handleChange('selling_rate', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Units</label>
              <input
                type="number"
                value={form.units}
                onChange={(e) => handleChange('units', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          {/* Reimbursement Amount + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Reimbursement Amount</label>
              <input
                type="number"
                value={form.reimbursement_amt}
                readOnly
                className={`${inputClass} bg-gray-50 text-gray-500`}
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={form.claim_type}
                onChange={(e) => handleChange('claim_type', e.target.value)}
                className={inputClass}
              >
                <option value="">Select type...</option>
                <option value="sale">Sale</option>
                <option value="reimbursement">Reimbursement</option>
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className={labelClass}>Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              placeholder="Reason for claim..."
              rows={3}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleCloseCreate}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors disabled:opacity-50"
            >
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