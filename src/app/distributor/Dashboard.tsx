import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import KPICard from '../../components/shared/KPICard'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
// --- ADDED ---
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
// --- END ---

const dispatchColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Dispatch Time', accessorKey: 'dispatched_at' },
  { header: 'ETA', accessorKey: 'eta' },
  { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusBadge status={getValue() as any} /> },
]

const inventoryColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: "SKU's", accessorKey: 'sku' },
  { header: 'Product Name', accessorKey: 'name' },
  { header: 'Total Stock', accessorKey: 'total_stock' },
]

const orderColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Date/Time', accessorKey: 'created_at', cell: ({ getValue }) => new Date(getValue() as string).toLocaleString('en-IN') },
  { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusBadge status={getValue() as any} /> },
]

export default function DistributorDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // --- ADDED state and fetches ---
  const [dispatches, setDispatches] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState(0)
  const [pendingClaims, setPendingClaims] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    if (profile?.distributor_id) {
      fetchDashboardData()
    }
  }, [profile])

  async function fetchDashboardData() {
    const distId = profile?.distributor_id

    // Active dispatches (in_transit)
    const { data: dispatchData } = await supabase
      .from('dispatches')
      .select('dispatch_id, dispatched_at, eta, status, purchase_orders(po_id)')
      .eq('distributor_id', distId)
      .eq('status', 'in_transit')
      .order('dispatched_at', { ascending: false })
      .limit(5)

    if (dispatchData) {
      setDispatches(dispatchData.map((r: any) => ({
        id: r.dispatch_id,
        po_no: r.purchase_orders?.po_id,
        dispatched_at: new Date(r.dispatched_at).toLocaleString('en-IN'),
        eta: r.eta ? new Date(r.eta).toLocaleDateString('en-IN') : '—',
        status: r.status,
      })))
    }

    // Inventory snapshot
    const { data: invData } = await supabase
      .from('distributor_inventory')
      .select('sku_id, total_stock, skus(name)')
      .eq('distributor_id', distId)
      .order('total_stock', { ascending: true })
      .limit(5)

    if (invData) {
      setInventory(invData.map((r: any) => ({
        sku: r.sku_id,
        name: r.skus?.name,
        total_stock: r.total_stock,
      })))
      setLowStockCount(invData.filter((r: any) => r.total_stock <= 10).length)
    }

    // Recent orders
    const { data: orderData } = await supabase
      .from('purchase_orders')
      .select('po_id, created_at, status')
      .eq('distributor_id', distId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (orderData) {
      setOrders(orderData.map((r: any) => ({
        po_no: r.po_id,
        created_at: r.created_at,
        status: r.status,
      })))
      setActiveOrders(orderData.filter((r: any) => ['pending', 'approved', 'dispatched'].includes(r.status)).length)
    }

    // Pending claims count
    const { count } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('distributor_id', distId)
      .eq('status', 'pending')

    setPendingClaims(count ?? 0)
  }
  // --- END ---

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* --- UPDATED KPI values --- */}
          <KPICard label="Active Orders" value={activeOrders.toString()} />
          <KPICard label="Pending Claims" value={pendingClaims.toString()} />
          <KPICard label="Items Low on Stock" value={lowStockCount.toString()} />
          {/* --- END --- */}
        </div>

        {/* Active Dispatches */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Active Dispatches</h2>
          <DataTable columns={dispatchColumns} data={dispatches} searchable={false} emptyMessage="No active dispatches" />
        </div>

        {/* Inventory Snapshot */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Inventory Snapshot</h2>
          <DataTable columns={inventoryColumns} data={inventory} searchable={false} emptyMessage="No inventory data" />
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Orders</h2>
            {/* --- ADDED navigate to create order --- */}
            <button
              onClick={() => navigate('/distributor/orders/create')}
              className="bg-[#eb2030] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c4001a] transition-colors"
            >Create Order</button>
            {/* --- END --- */}
          </div>
          <DataTable columns={orderColumns} data={orders} searchable={false} emptyMessage="No recent orders" />
        </div>

      </div>
    </AppLayout>
  )
}