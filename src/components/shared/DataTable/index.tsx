import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  searchable?: boolean
  searchPlaceholder?: string
  todayToggle?: boolean
  onRowClick?: (row: T) => void
  exportable?: boolean
  exportFilename?: string
  loading?: boolean
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search...',
  todayToggle = false,
  onRowClick,
  exportable = false,
  exportFilename = 'export',
  loading = false,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [todayOnly, setTodayOnly] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const filteredData = todayOnly
    ? data.filter((row) => {
        const r = row as Record<string, unknown>
        return Object.values(r).some(
          (v) => typeof v === 'string' && v.startsWith(today)
        )
      })
    : data

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function handleExport() {
    const rows = table.getFilteredRowModel().rows
    if (rows.length === 0) return
    const headers = columns
      .map((c) => (typeof c.header === 'string' ? c.header : String(c.id ?? '')))
      .join(',')
    const csvRows = rows.map((row) =>
      row.getVisibleCells().map((cell) => {
        const val = cell.getValue()
        return `"${String(val ?? '').replace(/"/g, '""')}"`
      }).join(',')
    )
    const csv = [headers, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportFilename}-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Toolbar ──────────────────────────────────────────────
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {searchable && (
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          className="border border-[#E0E0E0] rounded-md px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
      {todayToggle && (
        <button
          onClick={() => setTodayOnly((v) => !v)}
          className={`px-3 py-2 rounded-md text-sm border transition-colors ${
            todayOnly
              ? 'bg-primary text-white border-primary'
              : 'border-[#E0E0E0] text-gray-600 hover:bg-gray-50'
          }`}
        >
          Today
        </button>
      )}
      {exportable && (
        <button
          onClick={handleExport}
          className="px-3 py-2 rounded-md text-sm border border-[#E0E0E0] text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Export CSV
        </button>
      )}
    </div>
  )

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div>
        {toolbar}
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────
  const isEmpty = table.getFilteredRowModel().rows.length === 0

  return (
    <div>
      {toolbar}
      <div className="overflow-x-auto rounded-lg border border-[#E0E0E0] -mx-4 sm:mx-0">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F5F5]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="text-left text-xs font-medium uppercase text-gray-500 px-4 py-3 cursor-pointer select-none whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] bg-white">
            {isEmpty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center text-sm text-gray-400 py-10"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getFilteredRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-[#F5F5F5]' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-900 whitespace-nowrap text-left align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}