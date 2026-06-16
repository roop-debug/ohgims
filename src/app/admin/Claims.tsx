import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'

interface ClaimRow {
  id: string
  claim_number: string
  distributor: string
  distributor_id: string
  claim_amount: number
  claim_type: string
  status: 'pending' | 'approved' | 'declined'
  price_point: number
  selling_price: number
  reason: string
  invoice_url: string | null
  sku_id: string
  units: number
}

export default function AdminClaims() {
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [data, setData] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchClaims() }, [])

  async function fetchClaims() {
    const { data, error } = await supabase
      .from('claims')
      .select(`
        claim_id,
        claim_type,
        reimbursement_amt,
        status,
        rate,
        selling_rate,
        units,
        reason,
        invoice_url,
        sku_id,
        distributor_id,
        distributors (name)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.claim_id,
        claim_number: row.claim_id,
        distributor: row.distributors?.name,
        distributor_id: row.distributor_id,
        claim_amount: row.reimbursement_amt,
        claim_type: row.claim_type,
        status: row.status,
        price_point: row.rate,
        selling_price: row.selling_rate,
        reason: row.reason,
        invoice_url: row.invoice_url,
        sku_id: row.sku_id,
        units: row.units,
      })))
    }
    setLoading(false)
  }

  function handleRowClick(row: ClaimRow) {
    setSelectedClaim(row)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedClaim(null)
  }

  async function handleApprove() {
    if (!selectedClaim || submitting) return
    setSubmitting(true)
    const { error } = await supabase
      .from('claims')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('claim_id', selectedClaim.id)
    if (error) { console.error(error); setSubmitting(false); return }

    await supabase.functions.invoke('notify-claim-status', {
      body: { claim_id: selectedClaim.id, new_status: 'approved' }
    })

    setSubmitting(false)
    handleClose()
    fetchClaims()
  }

  async function handleDecline() {
    if (!selectedClaim || submitting) return
    setSubmitting(true)
    const { error } = await supabase
      .from('claims')
      .update({ status: 'declined', resolved_at: new Date().toISOString() })
      .eq('claim_id', selectedClaim.id)
    if (error) { console.error(error); setSubmitting(false); return }

    await supabase.functions.invoke('notify-claim-status', {
      body: { claim_id: selectedClaim.id, new_status: 'declined' }
    })

    setSubmitting(false)
    handleClose()
    fetchClaims()
  }

  async function getInvoiceUrl(path: string) {
    const { data } = await supabase.storage
      .from('claim-invoices')
      .createSignedUrl(path, 60)
    return data?.signedUrl ?? null
  }

  const columns: ColumnDef<ClaimRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    {
      header: 'Claim ID',
      accessorKey: 'claim_number',
      cell: ({ getValue }) => (
        <span className="text-[#eb2030] underline cursor-pointer">{getValue() as string}</span>
      ),
    },
    { header: 'Distributor', accessorKey: 'distributor' },
    {
      header: 'Claim Amount',
      accessorKey: 'claim_amount',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
    },
    { header: 'Claim Type', accessorKey: 'claim_type' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Claims</h1>
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

      <Modal open={modalOpen} title="Claim Approval" onClose={handleClose}>
        {selectedClaim && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Claim No</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.claim_number}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Claim Type</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.claim_type}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Distributor</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.distributor}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">SKU</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.sku_id}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Price Point</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.price_point.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Selling Price</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.selling_price.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Units</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.units}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#eb2030] mb-1">Claim Amount</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.claim_amount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[#eb2030] mb-1">Reason</p>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[60px]">
                {selectedClaim.reason || '—'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs font-medium text-[#eb2030]">Invoice</p>
              {selectedClaim.invoice_url ? (
                <button
                  onClick={async () => {
                    const url = await getInvoiceUrl(selectedClaim.invoice_url!)
                    if (url) window.open(url, '_blank')
                  }}
                  className="px-4 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
                >
                  View Invoice
                </button>
              ) : (
                <span className="text-sm text-gray-400">No invoice uploaded</span>
              )}
            </div>

            {selectedClaim.status === 'pending' && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleDecline}
                  disabled={submitting}
                  className="flex-1 py-2 text-sm border border-[#eb2030] text-[#eb2030] rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Decline'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex-1 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Approve'}
                </button>
              </div>
            )}
            {selectedClaim.status !== 'pending' && (
              <div className="flex justify-center">
                <StatusBadge status={selectedClaim.status} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}