import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface DispatchRow {
  id: string
  distributor: string
  po_no: string
  dispatched_at: string
  status: 'in_transit' | 'delivered'
  eta: string | null
}

const data: DispatchRow[] = []

export default function AdminDispatch() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchRow | null>(null)

  // Add Dispatch form state
  const [newDistributor, setNewDistributor] = useState('')
  const [newPONo, setNewPONo] = useState('')
  const [newETA, setNewETA] = useState('')

  // Manage Status state
  const [newStatus, setNewStatus] = useState<'in_transit' | 'delivered'>('in_transit')

  function handleManageStatus(row: DispatchRow) {
    setSelectedDispatch(row)
    setNewStatus(row.status)
    setStatusModalOpen(true)
  }

  const columns: ColumnDef<DispatchRow>[] = [
    { header: 'No', cell: ({ row }) => row.index + 1 },
    { header: 'Distributor', accessorKey: 'distributor' },
    { header: 'PO No', accessorKey: 'po_no' },
    { header: 'Dispatch Date/Time', accessorKey: 'dispatched_at' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
    { header: 'ETA', accessorKey: 'eta', cell: ({ getValue }) => getValue() ?? '—' },
    {
      header: 'Action',
      cell: ({ row }) => (
        <button
          onClick={() => handleManageStatus(row.original)}
          className="text-xs text-[#E8400C] hover:underline"
        >
          Manage
        </button>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* Header */}
        <h1 className="text-lg font-semibold text-gray-900">Dispatches</h1>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          searchable
          exportable
          exportFilename="dispatches"
          todayToggle
          emptyMessage="No dispatches found"
        />

        {/* Bottom buttons */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            Add Dispatch
          </button>
          <button
            onClick={() => setStatusModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            Manage Status
          </button>
        </div>

      </div>

      {/* Add Dispatch Modal */}
      <Modal
        open={addModalOpen}
        title="Add Dispatch"
        onClose={() => setAddModalOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distributor</label>
            <select
              value={newDistributor}
              onChange={(e) => setNewDistributor(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            >
              <option value="">Select distributor...</option>
              {/* populated from Supabase after DB setup */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
            <input
              value={newPONo}
              onChange={(e) => setNewPONo(e.target.value)}
              placeholder="e.g. PO-2026-001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ETA</label>
            <input
              type="datetime-local"
              value={newETA}
              onChange={(e) => setNewETA(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <button className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2">
            Add Dispatch
          </button>
        </div>
      </Modal>

      {/* Manage Status Modal */}
      <Modal
        open={statusModalOpen}
        title={selectedDispatch ? `Update Status — ${selectedDispatch.po_no}` : 'Manage Status'}
        onClose={() => { setStatusModalOpen(false); setSelectedDispatch(null) }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Select the new status for this dispatch:</p>
          <div className="flex flex-col gap-2">
            {(['in_transit', 'delivered'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setNewStatus(status)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-sm ${
                  newStatus === status
                    ? 'border-[#E8400C] bg-orange-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <StatusBadge status={status} />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
          <button className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2">
            Save Status
          </button>
        </div>
      </Modal>

    </AppLayout>
  )
}