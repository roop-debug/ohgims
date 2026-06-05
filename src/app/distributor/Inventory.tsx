import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface InventoryRow {
  id: string
  sku_id: string
  name: string
  total_stock: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

const data: InventoryRow[] = []

export default function DistributorInventory() {
  const [loading] = useState(false)

  const columns: ColumnDef<InventoryRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'SKU', accessorKey: 'sku_id' },
    { header: 'Item Name', accessorKey: 'name' },
    { header: 'Total Stock', accessorKey: 'total_stock' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Inventory</h1>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchable
          exportable
          exportFilename="distributor-inventory"
          emptyMessage="No inventory found"
        />
      </div>
    </AppLayout>
  )
}