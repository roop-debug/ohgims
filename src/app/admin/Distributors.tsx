import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import KPICard from '../../components/shared/KpiCard'
import type { ColumnDef } from '@tanstack/react-table'

interface DistributorRow {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  purchased: number
  sold: number
  total: number
  revenue: number
}

const data: DistributorRow[] = []

export default function AdminDistributors() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorRow | null>(null)

  // Add Distributor form state
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  function handleRowClick(row: DistributorRow) {
    setSelectedDistributor(row)
    setDetailsModalOpen(true)
  }

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
          <KPICard label="No. of Distributors" value="—" />
          <KPICard label="Total Units Sold" value="—" />
          <KPICard label="Total Units Bought" value="—" />
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
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. ABC Distributors"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. john@abc.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            />
          </div>
          <button className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2">
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