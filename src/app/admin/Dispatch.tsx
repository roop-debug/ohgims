import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'

interface DispatchRow {
  id: string
  distributor: string
  distributor_id: string
  po_no: string
  dispatched_at: string
  status: 'pending' | 'in_transit' | 'delivered'
  eta: string | null
}

export default function AdminDispatch() {
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchRow | null>(null)
  const [newStatus, setNewStatus] = useState<'pending' | 'in_transit' | 'delivered'>('pending')
  const [newETA, setNewETA] = useState('')
  const [data, setData] = useState<DispatchRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDispatches() }, [])

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

  async function handleSaveStatus() {
    if (!selectedDispatch) return

    const updateData: any = { status: newStatus }

    if (newStatus === 'in_transit') {
      updateData.dispatched_at = new Date().toISOString()
      updateData.eta = newETA || null
    }

    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('dispatches')
      .update(updateData)
      .eq('dispatch_id', selectedDispatch.id)

    if (error) { console.error(error); return }

    if (newStatus === 'in_transit') {
      await supabase
        .from('purchase_orders')
        .update({ status: 'dispatched' })
        .eq('po_id', selectedDispatch.po_no)

      const { data: lineItems } = await supabase
        .from('po_line_items')
        .select('sku_id, quantity')
        .eq('po_id', selectedDispatch.po_no)

      if (lineItems) {
        for (const item of lineItems) {
          const { data: currentInv } = await supabase
            .from('master_inventory')
            .select('inventory_id, stock_out, total_stock')
            .eq('sku_id', item.sku_id)
            .maybeSingle()

          if (currentInv) {
            const newTotal = currentInv.total_stock - item.quantity
            await supabase
              .from('master_inventory')
              .update({
                stock_out: currentInv.stock_out + item.quantity,
                total_stock: newTotal,
                status: newTotal <= 0 ? 'Out of Stock' : newTotal <= 10 ? 'Low Stock' : 'In Stock',
                date: new Date().toISOString().split('T')[0],
              })
              .eq('inventory_id', currentInv.inventory_id)
          }
        }
      }
    }

    if (newStatus === 'delivered') {
      await supabase
        .from('purchase_orders')
        .update({ status: 'delivered' })
        .eq('po_id', selectedDispatch.po_no)

      const { data: lineItems } = await supabase
        .from('po_line_items')
        .select('sku_id, quantity')
        .eq('po_id', selectedDispatch.po_no)

      if (lineItems) {
        for (const item of lineItems) {
          const { data: currentInv } = await supabase
            .from('distributor_inventory')
            .select('dist_inventory_id, stock_in, total_stock')
            .eq('distributor_id', selectedDispatch.distributor_id)
            .eq('sku_id', item.sku_id)
            .maybeSingle()

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
    setNewETA('')
    fetchDispatches()
  }

  function handleManageStatus(row: DispatchRow) {
    setSelectedDispatch(row)
    setNewStatus(row.status)
    setNewETA('')
    setStatusModalOpen(true)
  }

  // --- ADDED helper to get allowed next statuses ---
  function getAllowedStatuses(current: DispatchRow['status']): DispatchRow['status'][] {
    if (current === 'pending') return ['pending', 'in_transit', 'delivered']
    if (current === 'in_transit') return ['in_transit', 'delivered']
    return [] // delivered — no changes allowed
  }
  // --- END ---

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
      cell: ({ row }) => {
        // --- UPDATED to hide Manage button for delivered dispatches ---
        if (row.original.status === 'delivered') return null
        return (
          <button
            onClick={() => handleManageStatus(row.original)}
            className="text-xs text-[#E8400C] hover:underline"
          >
            Manage
          </button>
        )
        // --- END ---
      },
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Dispatches</h1>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="dispatches"
          todayToggle
          emptyMessage="No dispatches found"
        />
      </div>

      <Modal
        open={statusModalOpen}
        title={selectedDispatch ? `Update Status — ${selectedDispatch.po_no}` : 'Manage Status'}
        onClose={() => { setStatusModalOpen(false); setSelectedDispatch(null); setNewETA('') }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Select the new status for this dispatch:</p>
          <div className="flex flex-col gap-2">
            {/* --- UPDATED to only show allowed statuses based on current status --- */}
            {selectedDispatch && getAllowedStatuses(selectedDispatch.status).map((status) => (
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
            {/* --- END --- */}
          </div>

          {newStatus === 'in_transit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ETA</label>
              <input
                type="datetime-local"
                value={newETA}
                onChange={(e) => setNewETA(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8400C]"
              />
            </div>
          )}

          <button
            onClick={handleSaveStatus}
            className="w-full bg-[#E8400C] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c93509] transition-colors mt-2"
          >
            Save Status
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}