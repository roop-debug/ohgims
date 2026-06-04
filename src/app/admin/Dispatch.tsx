import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED imports ---
import { supabase } from '../../lib/supabase'
// --- END ---

interface DispatchRow {
  id: string
  distributor: string
  distributor_id: string
  po_no: string
  dispatched_at: string
  status: 'in_transit' | 'delivered'
  eta: string | null
}

// --- ADDED interfaces for dropdowns ---
interface DistributorOption {
  id: string
  name: string
}

interface POOption {
  id: string
  po_id: string
}
// --- END ---

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

  // --- ADDED data state ---
  const [data, setData] = useState<DispatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [distributors, setDistributors] = useState<DistributorOption[]>([])
  const [poOptions, setPOOptions] = useState<POOption[]>([])
  // --- END ---

  // --- ADDED fetch functions ---
  async function fetchDispatches() {
    const { data, error } = await supabase
      .from('dispatches')
      .select(`
        dispatch_id,
        dispatched_at,
        status,
        eta,
        purchase_orders (po_id),
        distributors (name, distributor_id)
      `)
      .order('dispatched_at', { ascending: false })

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.dispatch_id,
        distributor: row.distributors?.name,
        distributor_id: row.distributors?.distributor_id,
        po_no: row.purchase_orders?.po_id,
        dispatched_at: new Date(row.dispatched_at).toLocaleString('en-IN'),
        status: row.status,
        eta: row.eta ?? null,
      })))
    }
    setLoading(false)
  }

  async function fetchDistributors() {
    const { data, error } = await supabase
      .from('distributors')
      .select('distributor_id, name')

    if (!error && data) {
      setDistributors(data.map((d: any) => ({ id: d.distributor_id, name: d.name })))
    }
  }

  async function fetchApprovedPOs(distributorId: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('po_id')
      .eq('distributor_id', distributorId)
      .eq('status', 'approved')

    if (!error && data) {
      setPOOptions(data.map((po: any) => ({ id: po.po_id, po_id: po.po_id })))
    } else {
      setPOOptions([])
    }
  }

  useEffect(() => {
    fetchDispatches()
    fetchDistributors()
  }, [])
  // --- END ---

  // --- ADDED handleAddDispatch ---
  async function handleAddDispatch() {
    if (!newDistributor || !newPONo) return

    const { error } = await supabase
      .from('dispatches')
      .insert({
        po_id: newPONo,
        distributor_id: newDistributor,
        dispatched_at: new Date().toISOString(),
        eta: newETA || null,
        status: 'in_transit',
      })

    if (error) { console.error(error); return }

    // Update PO status to dispatched
    await supabase
      .from('purchase_orders')
      .update({ status: 'dispatched' })
      .eq('po_id', newPONo)

    setNewDistributor('')
    setNewPONo('')
    setNewETA('')
    setPOOptions([])
    setAddModalOpen(false)
    fetchDispatches()
  }
  // --- END ---

  // --- ADDED handleSaveStatus ---
  async function handleSaveStatus() {
    if (!selectedDispatch) return

    const { error } = await supabase
      .from('dispatches')
      .update({
        status: newStatus,
        delivered_at: newStatus === 'delivered' ? new Date().toISOString() : null,
      })
      .eq('dispatch_id', selectedDispatch.id)

    if (error) { console.error(error); return }

    // If delivered, update PO status and distributor inventory
    if (newStatus === 'delivered') {
      // Update PO status
      await supabase
        .from('purchase_orders')
        .update({ status: 'delivered' })
        .eq('po_id', selectedDispatch.po_no)

      // Fetch PO line items to update distributor inventory
      const { data: lineItems } = await supabase
        .from('po_line_items')
        .select('sku_id, quantity')
        .eq('po_id', selectedDispatch.po_no)

      if (lineItems) {
        for (const item of lineItems) {
          // Get current distributor inventory for this SKU
          const { data: currentInv } = await supabase
            .from('distributor_inventory')
            .select('dist_inventory_id, stock_in, total_stock')
            .eq('distributor_id', selectedDispatch.distributor_id)
            .eq('sku_id', item.sku_id)
            .single()

          if (currentInv) {
            const newTotal = currentInv.total_stock + item.quantity
            await supabase
              .from('distributor_inventory')
              .update({
                stock_in: currentInv.stock_in + item.quantity,
                total_stock: newTotal,
                status: newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock',
                date: new Date().toISOString().split('T')[0],
              })
              .eq('dist_inventory_id', currentInv.dist_inventory_id)
          }
        }
      }
    }

    setStatusModalOpen(false)
    setSelectedDispatch(null)
    fetchDispatches()
  }
  // --- END ---

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
        <div className="flex items-center mt-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-sm bg-[#E8400C] text-white rounded-lg hover:bg-[#c93509] transition-colors"
          >
            Add Dispatch
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
            {/* --- UPDATED dropdown populated from Supabase --- */}
            <select
              value={newDistributor}
              onChange={(e) => {
                setNewDistributor(e.target.value)
                setNewPONo('')
                if (e.target.value) fetchApprovedPOs(e.target.value)
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
            >
              <option value="">Select distributor...</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {/* --- END --- */}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
            {/* --- UPDATED dropdown populated from approved POs of selected distributor --- */}
            <select
              value={newPONo}
              onChange={(e) => setNewPONo(e.target.value)}
              disabled={!newDistributor}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C] disabled:opacity-50"
            >
              <option value="">Select PO...</option>
              {poOptions.map((po) => (
                <option key={po.id} value={po.id}>{po.po_id}</option>
              ))}
            </select>
            {/* --- END --- */}
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
          {/* --- ADDED onClick --- */}
          <button
            onClick={handleAddDispatch}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2"
          >
            Add Dispatch
          </button>
          {/* --- END --- */}
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
          {/* --- ADDED onClick --- */}
          <button
            onClick={handleSaveStatus}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2"
          >
            Save Status
          </button>
          {/* --- END --- */}
        </div>
      </Modal>

    </AppLayout>
  )
}