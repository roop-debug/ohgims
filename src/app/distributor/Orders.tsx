// src/app/distributor/Orders.tsx

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/shared/AppLayout'
import type { PurchaseOrder } from '../../types'

// ── Type for joined view (replace with Supabase join) ─────────────────────────
interface OrderRow {
  sr: number
  poNo: string
  purchaseDateTime: string
  status: PurchaseOrder['status']
  eta: string | null
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query filtered by auth().distributor_id
// const MOCK_ORDERS: OrderRow[] = [
//   { sr: 1, poNo: 'PO-2026-0001', purchaseDateTime: '2026-06-01 10:00', status: 'pending',    eta: null },
//   { sr: 2, poNo: 'PO-2026-0002', purchaseDateTime: '2026-06-02 14:30', status: 'dispatched', eta: '2026-06-05' },
// ]

const STATUS_STYLES: Record<PurchaseOrder['status'], string> = {
  pending:    'text-amber-500',
  approved:   'text-blue-500',
  dispatched: 'text-purple-500',
  delivered:  'text-green-600',
  cancelled:  'text-red-500',
}

function exportToCSV(rows: OrderRow[]) {
  // TODO: replace with real Supabase data when backend is wired
  const headers = ['Sr No.', 'PO No.', 'Purchase Date/Time', 'Status', 'ETA']
  const csvRows = rows.map((r) =>
    [r.sr, r.poNo, r.purchaseDateTime, r.status, r.eta ?? '-'].join(',')
  )
  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], {
    type: 'text/csv',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'orders.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function DistributorOrders() {
  const navigate = useNavigate()

  const [todayOnly, setTodayOnly] = useState(false)

  // TODO: replace with Supabase query filtered by auth().distributor_id
  const [orders] = useState<OrderRow[]>([])

  const filteredOrders = useMemo(() => {
    if (!todayOnly) return orders
    const today = new Date().toISOString().slice(0, 10)
    return orders.filter((o) => o.purchaseDateTime.startsWith(today))
  }, [orders, todayOnly])

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* ── Main card ── */}
        <div className="rounded-2xl overflow-hidden border border-[#C8102E]">

          {/* Red header */}
          <div className="bg-[#C8102E] px-5 py-4 flex items-center gap-4">
            <h1 className="text-white text-sm font-bold uppercase tracking-wider flex-1">
              Orders Overview
            </h1>

            {/* TODO: open filter panel/drawer on click */}
            <button className="text-white text-sm font-semibold hover:opacity-75 transition-opacity">
              Filters
            </button>

            {/* Today toggle */}
            <button
              onClick={() => setTodayOnly((prev) => !prev)}
              className={`text-sm font-semibold transition-opacity px-1 ${
                todayOnly ? 'text-yellow-300' : 'text-white hover:opacity-75'
              }`}
            >
              Today
            </button>

            {/* Create Orders */}
            <button
              onClick={() => navigate('/distributor/orders/create')}
              className="flex items-center gap-1.5 bg-[#FEFDE8] text-[#C8102E] text-sm font-bold px-4 py-2 rounded-full hover:brightness-95 transition-all"
            >
              <span className="text-base leading-none">⊕</span>
              Create Orders
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[60px_1fr_2fr_1fr_1fr] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-2">
            <span className="text-[#C8102E] text-xs font-bold">Sr No.</span>
            <span className="text-[#C8102E] text-xs font-bold">PO No.</span>
            <span className="text-[#C8102E] text-xs font-bold">Purchase Date/Time</span>
            <span className="text-[#C8102E] text-xs font-bold">Status</span>
            <span className="text-[#C8102E] text-xs font-bold">ETA</span>
          </div>

          {/* Rows */}
          <div className="bg-[#FEFDE8] min-h-[400px]">
            {filteredOrders.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                No orders found.
              </p>
            ) : (
              filteredOrders.map((row) => (
                <div
                  key={row.sr}
                  onClick={() => navigate(`/distributor/orders/${row.poNo}`)}
                  className="grid grid-cols-[60px_1fr_2fr_1fr_1fr] px-4 py-3 border-b border-[#E0DDB0] cursor-pointer hover:brightness-95 transition-all"
                >
                  <span className="text-sm text-gray-800">{row.sr}</span>
                  <span className="text-sm text-gray-800">{row.poNo}</span>
                  <span className="text-sm text-gray-800">{row.purchaseDateTime}</span>
                  <span className={`text-xs font-semibold capitalize ${STATUS_STYLES[row.status]}`}>
                    {row.status}
                  </span>
                  <span className="text-sm text-gray-800">{row.eta ?? '—'}</span>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ── Export to sheets ── */}
        <div className="flex justify-end">
          <button
            onClick={() => exportToCSV(filteredOrders)}
            className="bg-[#C8102E] text-white text-sm font-bold px-6 py-3 rounded-full hover:brightness-90 transition-all"
          >
            Export to sheets
          </button>
        </div>

      </div>
    </AppLayout>
  )
}

