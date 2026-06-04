import AppLayout from '../../components/shared/AppLayout'
import KPICard from '../../components/shared/KPICard'
import DataTable from '../../components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

const dispatchColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Dispatch Time', accessorKey: 'dispatched_at' },
  { header: 'ETA', accessorKey: 'eta' },
  { header: 'Status', accessorKey: 'status' },
]

const inventoryColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: "SKU's", accessorKey: 'sku' },
  { header: 'Product Name', accessorKey: 'name' },
  { header: 'Total Stock', accessorKey: 'total_stock' },
]

const orderColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Date/Time', accessorKey: 'created_at' },
  { header: 'Status', accessorKey: 'status' },
]

export default function DistributorDashboard() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Active Orders" value="—" />
          <KPICard label="Pending Claims" value="—" />
          <KPICard label="Items Low on Stock" value="—" />
        </div>

        {/* Active Dispatches */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Active Dispatches
          </h2>
          <DataTable
            columns={dispatchColumns}
            data={[]}
            searchable={false}
            emptyMessage="No active dispatches"
          />
        </div>

        {/* Inventory Snapshot */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Inventory Snapshot
          </h2>
          <DataTable
            columns={inventoryColumns}
            data={[]}
            searchable={false}
            emptyMessage="No inventory data"
          />
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Recent Orders
            </h2>
            <button className="bg-[#E8400C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c93509] transition-colors">
              Create Order
            </button>
          </div>
          <DataTable
            columns={orderColumns}
            data={[]}
            searchable={false}
            emptyMessage="No recent orders"
          />
        </div>

      </div>
    </AppLayout>
  )
}