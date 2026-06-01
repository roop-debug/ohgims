import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface TestRow {
  name: string
  status: string
  amount: number
}

const columns: ColumnDef<TestRow>[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Status', accessorKey: 'status' },
  { header: 'Amount', accessorKey: 'amount' },
]

const data: TestRow[] = [
  { name: 'Distributor A', status: 'Active', amount: 5000 },
  { name: 'Distributor B', status: 'Pending', amount: 3200 },
  { name: 'Distributor C', status: 'Inactive', amount: 1800 },
]

export default function AdminDashboard() {
  return (
    <AppLayout>
      <DataTable columns={columns} data={data} searchable exportable exportFilename="test" />
    </AppLayout>
  )
}