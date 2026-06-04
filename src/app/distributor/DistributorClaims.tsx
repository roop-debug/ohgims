// src/app/distributor/DistributorClaims.tsx

import { useState, useMemo } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import type { Claim } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClaimRow {
  sr: number
  claimId: string
  claimAmount: number
  claimType: string
  status: Claim['status']
}

interface ClaimForm {
  invoiceFile: File | null
  skuId: string
  rate: number
  sellingRate: string
  units: string
  reimbursementAmount: number
  claimType: string
  reason: string
}
// ─────────────────────────────────────────────────────────────────────────────

// TODO: replace with Supabase query filtered by auth().distributor_id
// const MOCK_CLAIMS: ClaimRow[] = [
//   { sr: 1, claimId: 'CLM-2026-0001', claimAmount: 1200, claimType: 'Damage',   status: 'pending' },
//   { sr: 2, claimId: 'CLM-2026-0002', claimAmount: 850,  claimType: 'Shortage', status: 'approved' },
// ]

// TODO: replace with Supabase query to fetch all SKUs for the dropdown
// const MOCK_SKUS = [
//   { id: 'sku-1', name: 'Product A', rate: 100 },
//   { id: 'sku-2', name: 'Product B', rate: 200 },
// ]

const CLAIM_TYPES = ['Damage', 'Shortage', 'Expiry', 'Other']

const STATUS_STYLES: Record<Claim['status'], string> = {
  pending:  'text-amber-500',
  approved: 'text-green-600',
  declined: 'text-red-500',
}

const EMPTY_FORM: ClaimForm = {
  invoiceFile:         null,
  skuId:               '',
  rate:                0,
  sellingRate:         '',
  units:               '',
  reimbursementAmount: 0,
  claimType:           '',
  reason:              '',
}

export default function DistributorClaims() {
  const [searchQuery, setSearchQuery] = useState('')
  const [todayOnly, setTodayOnly]     = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState<ClaimForm>(EMPTY_FORM)

  // TODO: replace with Supabase query filtered by auth().distributor_id
  const [claims] = useState<ClaimRow[]>([])

  // TODO: replace with Supabase query to fetch all SKUs
  const [skus] = useState<{ id: string; name: string; rate: number }[]>([])

  const filteredClaims = useMemo(() => {
    let result = claims
    if (todayOnly) {
      // TODO: filter by created_at date once Supabase data is wired
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.claimId.toLowerCase().includes(q) ||
          c.claimType.toLowerCase().includes(q)
      )
    }
    return result
  }, [claims, searchQuery, todayOnly])

  function handleOpenModal() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
  }

  function handleSkuChange(skuId: string) {
    const selected = skus.find((s) => s.id === skuId)
    setForm((prev) => ({
      ...prev,
      skuId,
      rate: selected?.rate ?? 0,
      reimbursementAmount: calcReimbursement(
        selected?.rate ?? 0,
        prev.sellingRate,
        prev.units
      ),
    }))
  }

  function handleSellingRateChange(value: string) {
    setForm((prev) => ({
      ...prev,
      sellingRate: value,
      reimbursementAmount: calcReimbursement(prev.rate, value, prev.units),
    }))
  }

  function handleUnitsChange(value: string) {
    setForm((prev) => ({
      ...prev,
      units: value,
      reimbursementAmount: calcReimbursement(prev.rate, prev.sellingRate, value),
    }))
  }

  function calcReimbursement(
    rate: number,
    sellingRate: string,
    units: string
  ): number {
    const sr = parseFloat(sellingRate) || 0
    const u  = parseFloat(units) || 0
    return Math.max(0, (rate - sr) * u)
  }

  async function handleSubmitClaim() {
    if (!form.skuId || !form.units || !form.claimType) return
    // TODO: Supabase storage upload for form.invoiceFile
    // TODO: Supabase insert into claims for auth().distributor_id
    // TODO: refetch claims after insert
    handleCloseModal()
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">

        {/* ── Create Claim button ── */}
        <div className="flex justify-end">
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 bg-[#FEFDE8] text-[#C8102E] text-sm font-bold px-4 py-2 rounded-full border border-[#C8102E] hover:brightness-95 transition-all"
          >
            <span className="text-base leading-none">⊕</span>
            Create Claim
          </button>
        </div>

        {/* ── Claims card ── */}
        <div className="rounded-2xl overflow-hidden border border-[#C8102E]">

          {/* Red header */}
          <div className="bg-[#C8102E] px-5 pt-4 pb-3 flex items-end gap-4">
            <div className="flex flex-col gap-3 flex-1">
              <h1 className="text-white text-sm font-bold uppercase tracking-wider">
                Inventory
              </h1>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 rounded-full bg-gray-100 text-gray-600 text-sm px-4 py-1.5 outline-none placeholder:text-gray-400"
                />
                {/* TODO: open filter panel/drawer on click */}
                <button className="text-white text-sm font-semibold hover:opacity-75 transition-opacity">
                  Filters
                </button>
              </div>
            </div>
            <button
              onClick={() => setTodayOnly((prev) => !prev)}
              className={`text-sm font-bold pb-1 transition-opacity ${
                todayOnly ? 'text-yellow-300' : 'text-white hover:opacity-75'
              }`}
            >
              Today
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] bg-[#FEFDE8] border-b border-[#E0DDB0] px-4 py-2">
            <span className="text-[#C8102E] text-xs font-bold">Sr No.</span>
            <span className="text-[#C8102E] text-xs font-bold">Claim ID</span>
            <span className="text-[#C8102E] text-xs font-bold">Claim Amount</span>
            <span className="text-[#C8102E] text-xs font-bold">Claim Type</span>
            <span className="text-[#C8102E] text-xs font-bold">Status</span>
          </div>

          {/* Rows */}
          <div className="bg-[#FEFDE8] min-h-[400px]">
            {filteredClaims.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                No claims found.
              </p>
            ) : (
              filteredClaims.map((row) => (
                <div
                  key={row.sr}
                  className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#E0DDB0]"
                >
                  <span className="text-sm text-gray-800">{row.sr}</span>
                  <span className="text-sm text-gray-800">{row.claimId}</span>
                  <span className="text-sm text-gray-800">₹{row.claimAmount.toLocaleString()}</span>
                  <span className="text-sm text-gray-800">{row.claimType}</span>
                  <span className={`text-xs font-semibold capitalize ${STATUS_STYLES[row.status]}`}>
                    {row.status}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* ── Create Claim Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-xl bg-[#FEFDE8] rounded-2xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Invoice row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[#C8102E] text-sm font-bold">Invoice :</span>
                <label className="bg-[#C8102E] text-white text-sm font-bold px-4 py-2 rounded-lg cursor-pointer hover:brightness-90 transition-all">
                  Upload Invoice
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invoiceFile: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </label>
                {form.invoiceFile && (
                  <span className="text-xs text-gray-600 truncate max-w-[120px]">
                    {form.invoiceFile.name}
                  </span>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="text-[#C8102E] text-lg font-bold hover:opacity-75 transition-opacity"
              >
                X
              </button>
            </div>

            {/* SKU row */}
            <div className="flex items-center gap-3">
              <span className="text-[#C8102E] text-sm font-bold w-24">SKU :</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={skus.find((s) => s.id === form.skuId)?.name ?? ''}
                  readOnly
                  className="w-36 bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none"
                />
                {/* TODO: replace with proper SKU dropdown once Supabase is wired */}
                <select
                  value={form.skuId}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="bg-[#C8102E] text-white rounded-lg px-2 py-2 text-sm outline-none cursor-pointer"
                >
                  <option value="">▾</option>
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rate / Selling Rate / Units row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[#C8102E] text-sm font-bold">Rate:</span>
                <input
                  type="text"
                  value={form.rate || ''}
                  readOnly
                  className="w-24 bg-gray-100 border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#C8102E] text-sm font-bold">Selling Rate:</span>
                <input
                  type="number"
                  min={0}
                  value={form.sellingRate}
                  onChange={(e) => handleSellingRateChange(e.target.value)}
                  className="w-24 bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#C8102E] text-sm font-bold">Units:</span>
                <input
                  type="number"
                  min={0}
                  value={form.units}
                  onChange={(e) => handleUnitsChange(e.target.value)}
                  className="w-20 bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors"
                />
              </div>
            </div>

            {/* Reimbursement Amount / Type row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[#C8102E] text-sm font-bold">Reimbursement Amount :</span>
                <input
                  type="text"
                  value={form.reimbursementAmount || ''}
                  readOnly
                  className="w-24 bg-gray-100 border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#C8102E] text-sm font-bold">Type :</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={form.claimType}
                    readOnly
                    className="w-28 bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none"
                  />
                  <select
                    value={form.claimType}
                    onChange={(e) => setForm((prev) => ({ ...prev, claimType: e.target.value }))}
                    className="bg-[#C8102E] text-white rounded-lg px-2 py-2 text-sm outline-none cursor-pointer"
                  >
                    <option value="">▾</option>
                    {CLAIM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Reason row */}
            <div className="flex items-start gap-2">
              <span className="text-[#C8102E] text-sm font-bold w-24 pt-2">Reason :</span>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                rows={3}
                className="flex-1 bg-white border border-[#E0DDB0] rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C8102E] transition-colors resize-none"
              />
            </div>

            {/* Cancel / Submit */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="text-[#C8102E] text-sm font-bold px-6 py-2 rounded-full border border-[#C8102E] hover:bg-[#C8102E]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitClaim}
                className="bg-[#C8102E] text-white text-sm font-bold px-6 py-2 rounded-full hover:brightness-90 transition-all"
              >
                Submit Request
              </button>
            </div>

          </div>
        </div>
      )}

    </AppLayout>
  )
}