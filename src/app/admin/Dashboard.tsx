import AppLayout from '../../components/shared/AppLayout'
import KPICard from '../../components/shared/KPICard'
import DataTable from '../../components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

// Temporary empty data — replace with Supabase fetch after DB setup
const claimColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: 'Distributor', accessorKey: 'distributor' },
  { header: 'Claim Type', accessorKey: 'claim_type' },
  { header: 'Amount', accessorKey: 'amount' },
]

const dispatchColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: 'Distributor', accessorKey: 'distributor' },
  { header: 'PO No.', accessorKey: 'po_no' },
  { header: 'Dispatch Time', accessorKey: 'dispatched_at' },
  { header: 'ETA', accessorKey: 'eta' },
]

const inventoryColumns: ColumnDef<any>[] = [
  { header: 'Sr No.', accessorKey: 'sr' },
  { header: "SKU's", accessorKey: 'sku' },
  { header: 'Product Name', accessorKey: 'name' },
  { header: 'Total Stock', accessorKey: 'total_stock' },
]

export default function AdminDashboard() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Dispatches Made Today" value="—" />
          <KPICard label="Claims Pending" value="—" />
        </div>

        {/* Active Claims */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Active Claims
          </h2>
          <DataTable
            columns={claimColumns}
            data={[]}
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
            <button className="bg-[#E8400C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c93509] transition-colors">
              Add Dispatch
            </button>
          </div>
          <DataTable
            columns={dispatchColumns}
            data={[]}
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
            <button className="bg-[#E8400C] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#c93509] transition-colors">
              Add SKU
            </button>
          </div>
          <DataTable
            columns={inventoryColumns}
            data={[]}
            searchable={false}
            emptyMessage="No inventory data"
          />
        </div>

      </div>
    </AppLayout>
  )
}