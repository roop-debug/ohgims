import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface ClaimRow {
  id: string
  claim_number: string
  distributor: string
  claim_amount: number
  claim_type: string
  status: 'pending' | 'approved' | 'declined'
  price_point: number
  selling_price: number
  reason: string
  invoice_url: string | null
}

const data: ClaimRow[] = []

export default function AdminClaims() {
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function handleRowClick(row: ClaimRow) {
    setSelectedClaim(row)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setSelectedClaim(null)
  }

  const columns: ColumnDef<ClaimRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    {
      header: 'Claim ID',
      accessorKey: 'claim_number',
      cell: ({ getValue }) => (
        <span className="text-[#E8400C] underline cursor-pointer">
          {getValue() as string}
        </span>
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

        {/* Header */}
        <h1 className="text-lg font-semibold text-gray-900">Claims</h1>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          searchable
          exportable
          exportFilename="claims"
          todayToggle
          onRowClick={handleRowClick}
          emptyMessage="No claims found"
        />

      </div>

      {/* Claim Approval Modal */}
      <Modal
        open={modalOpen}
        title="Claim Approval"
        onClose={handleClose}
      >
        {selectedClaim && (
          <div className="flex flex-col gap-5">

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Claim No</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.claim_number}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Claim Type</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.claim_type}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Distributor</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {selectedClaim.distributor}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Price Point</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.price_point.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Selling Price</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.selling_price.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#E8400C] mb-1">Claim Amount</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900">
                  ₹{selectedClaim.claim_amount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <p className="text-xs font-medium text-[#E8400C] mb-1">Reason</p>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[60px]">
                {selectedClaim.reason || '—'}
              </div>
            </div>

            {/* Invoice */}
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium text-[#E8400C]">Invoice</p>
              {selectedClaim.invoice_url ? (
                <a
                  href={selectedClaim.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
                >
                  View Invoice
                </a>
              ) : (
                <span className="text-sm text-gray-400">No invoice uploaded</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2 text-sm border border-[#E8400C] text-[#E8400C] rounded-lg hover:bg-orange-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
              >
                Approve
              </button>
            </div>

          </div>
        )}
      </Modal>

    </AppLayout>
  )
}