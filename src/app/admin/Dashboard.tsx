import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import KPICard from '../../components/shared/KPICard'
import DataTable from '../../components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
// --- END ---

const claimColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: 'Distributor', accessorKey: 'distributor' },
  { header: 'Claim Type', accessorKey: 'claim_type' },
  {
    header: 'Amount',
    accessorKey: 'amount',
    cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
  },
]

const dispatchColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: 'Distributor', accessorKey: 'distributor' },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Dispatch Time', accessorKey: 'dispatched_at' },
  { header: 'ETA', accessorKey: 'eta' },
]

const inventoryColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: "SKU's", accessorKey: 'sku' },
  { header: 'Product Name', accessorKey: 'name' },
  { header: 'Total Stock', accessorKey: 'total_stock' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()

  // --- ADDED state ---
  const [claims, setClaims] = useState<any[]>([])
  const [dispatches, setDispatches] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [dispatchesToday, setDispatchesToday] = useState(0)
  const [pendingClaims, setPendingClaims] = useState(0)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    const today = new Date().toISOString().split('T')[0]

    // Active (pending) claims
    const { data: claimData } = await supabase
      .from('claims')
      .select('claim_id, claim_type, reimbursement_amt, distributors(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    if (claimData) {
      setClaims(claimData.map((r: any) => ({
        id: r.claim_id,
        distributor: r.distributors?.name,
        claim_type: r.claim_type,
        amount: r.reimbursement_amt,
      })))
      setPendingClaims(claimData.length)
    }

    // Active dispatches (in_transit)
    const { data: dispatchData } = await supabase
      .from('dispatches')
      .select('dispatch_id, dispatched_at, eta, purchase_orders(po_id), distributors(name)')
      .eq('status', 'in_transit')
      .order('dispatched_at', { ascending: false })
      .limit(5)

    if (dispatchData) {
      setDispatches(dispatchData.map((r: any) => ({
        id: r.dispatch_id,
        distributor: r.distributors?.name,
        po_no: r.purchase_orders?.po_id,
        dispatched_at: new Date(r.dispatched_at).toLocaleString('en-IN'),
        eta: r.eta ? new Date(r.eta).toLocaleDateString('en-IN') : '—',
      })))
    }

    // Dispatches made today
    const { count: todayCount } = await supabase
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .gte('dispatched_at', `${today}T00:00:00`)
      .lte('dispatched_at', `${today}T23:59:59`)

    setDispatchesToday(todayCount ?? 0)

    // Inventory availability from master_inventory (latest total per SKU)
    const { data: invData } = await supabase
      .from('master_inventory')
      .select('sku_id, total_stock, skus(name)')
      .order('date', { ascending: false })

    if (invData) {
      // Deduplicate — keep latest row per SKU
      const seen = new Set()
      const deduped = invData.filter((r: any) => {
        if (seen.has(r.sku_id)) return false
        seen.add(r.sku_id)
        return true
      })
      setInventory(deduped.map((r: any) => ({
        sku: r.sku_id,
        name: r.skus?.name,
        total_stock: r.total_stock,
      })))
    }
  }
  // --- END ---

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* --- UPDATED KPI values --- */}
          <KPICard label="Dispatches Made Today" value={dispatchesToday.toString()} />
          <KPICard label="Claims Pending" value={pendingClaims.toString()} />
          {/* --- END --- */}
        </div>

        {/* Active Claims */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Active Claims
          </h2>
          <DataTable
            columns={claimColumns}
            data={claims}
            searchable={false}
            emptyMessage="No active claims"
          />
        </div>

        {/* Active Dispatches */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Active Dispatches
            </h2>
            {/* --- ADDED navigate to dispatch page --- */}
            <button
              onClick={() => navigate('/admin/dispatch')}
              className="bg-[#E8400C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c93509] transition-colors"
            >
              Add Dispatch
            </button>
            {/* --- END --- */}
          </div>
          <DataTable
            columns={dispatchColumns}
            data={dispatches}
            searchable={false}
            emptyMessage="No active dispatches"
          />
        </div>

        {/* Inventory Availability */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Inventory Availability
            </h2>
            {/* --- ADDED navigate to inventory page --- */}
            <button
              onClick={() => navigate('/admin/inventory')}
              className="bg-[#E8400C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c93509] transition-colors"
            >
              Add SKU
            </button>
            {/* --- END --- */}
          </div>
          <DataTable
            columns={inventoryColumns}
            data={inventory}
            searchable={false}
            emptyMessage="No inventory data"
          />
        </div>

      </div>
    </AppLayout>
  )
}