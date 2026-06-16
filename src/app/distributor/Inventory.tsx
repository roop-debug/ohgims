import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface InventoryRow {
  id: string
  sku_id: string
  name: string
  total_stock: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  selling_price: number
  pcs_per_unit: number
}

export default function DistributorInventory() {
  const { profile } = useAuth()
  const [data, setData] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.distributor_id) fetchInventory()
  }, [profile])

  async function fetchInventory() {
    const { data, error } = await supabase
      .from('distributor_inventory')
      .select(`
        dist_inventory_id,
        sku_id,
        total_stock,
        status,
        skus (name, selling_price, pcs_per_unit)
      `)
      .eq('distributor_id', profile?.distributor_id)

    if (!error && data) {
      setData(data.map((row: any) => ({
        id: row.dist_inventory_id,
        sku_id: row.sku_id,
        name: row.skus?.name,
        total_stock: row.total_stock,
        status: row.total_stock <= 0 ? 'out_of_stock' : row.total_stock <= 10 ? 'low_stock' : 'in_stock',
        selling_price: row.skus?.selling_price ?? 0,
        pcs_per_unit: row.skus?.pcs_per_unit ?? 1,
      })))
    }
    setLoading(false)
  }

  const columns: ColumnDef<InventoryRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'SKU', accessorKey: 'sku_id' },
    { header: 'Item Name', accessorKey: 'name' },
    { header: 'Total Stock (boxes)', accessorKey: 'total_stock' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
    {
      header: 'Selling Price / Box',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          ₹{(row.original.selling_price * row.original.pcs_per_unit).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      ),
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