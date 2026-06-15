import { useState, useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'
import { supabase } from '../../lib/supabase'

interface SKUOption {
  sku_id: string
  name: string
  price: number
}

interface OfferRow {
  offer_id: string
  name: string
  description: string | null
  discount_type: 'percent' | 'value'
  discount_value: number
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'deactivated'
  created_at: string
  sku_names: string[]
}

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eb2030]'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function AdminOffers() {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [skuOptions, setSkuOptions] = useState<SKUOption[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<OfferRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formDiscountType, setFormDiscountType] = useState<'percent' | 'value'>('percent')
  const [formDiscountValue, setFormDiscountValue] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formSelectedSKUs, setFormSelectedSKUs] = useState<string[]>([])

  useEffect(() => {
    fetchOffers()
    fetchSKUs()
  }, [])

  async function fetchOffers() {
    const { data, error } = await supabase
      .from('offers')
      .select(`
        offer_id, name, description, discount_type, discount_value,
        start_date, end_date, status, created_at,
        offer_skus ( sku_id, skus ( name ) )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setOffers(data.map((row: any) => ({
        offer_id: row.offer_id,
        name: row.name,
        description: row.description,
        discount_type: row.discount_type,
        discount_value: row.discount_value,
        start_date: new Date(row.start_date).toLocaleDateString('en-IN'),
        end_date: new Date(row.end_date).toLocaleDateString('en-IN'),
        status: row.status,
        created_at: new Date(row.created_at).toLocaleDateString('en-IN'),
        sku_names: row.offer_skus?.map((os: any) => os.skus?.name).filter(Boolean) ?? [],
      })))
    }
    setLoading(false)
  }

  async function fetchSKUs() {
    const { data } = await supabase
      .from('skus')
      .select('sku_id, name, price')
      .eq('status', 'Active')
      .order('name')
    if (data) setSkuOptions(data)
  }

  function resetForm() {
    setFormName('')
    setFormDesc('')
    setFormDiscountType('percent')
    setFormDiscountValue('')
    setFormStartDate('')
    setFormEndDate('')
    setFormSelectedSKUs([])
    setError(null)
  }

  function toggleSKU(sku_id: string) {
    setFormSelectedSKUs((prev) =>
      prev.includes(sku_id) ? prev.filter((id) => id !== sku_id) : [...prev, sku_id]
    )
  }

  async function handleCreate() {
    setError(null)
    if (!formName.trim()) return setError('Offer name is required.')
    if (formSelectedSKUs.length === 0) return setError('Select at least one SKU.')
    if (!formDiscountValue || Number(formDiscountValue) <= 0) return setError('Enter a valid discount value.')
    if (!formStartDate || !formEndDate) return setError('Start and end dates are required.')
    if (new Date(formEndDate) <= new Date(formStartDate)) return setError('End date must be after start date.')

    setSubmitting(true)

    // [OFFERS] Check none of the selected SKUs already have an active offer
    const now = new Date().toISOString()
    const { data: conflicting } = await supabase
      .from('offer_skus')
      .select('sku_id, offers!inner(status, end_date)')
      .in('sku_id', formSelectedSKUs)
      .eq('offers.status', 'active')
      .gt('offers.end_date', now)

    if (conflicting && conflicting.length > 0) {
      const conflictIds = conflicting.map((c: any) => c.sku_id)
      const conflictNames = skuOptions
        .filter((s) => conflictIds.includes(s.sku_id))
        .map((s) => s.name)
      setError(`These SKUs already have an active offer: ${conflictNames.join(', ')}`)
      setSubmitting(false)
      return
    }

    // [OFFERS] Insert the offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        name: formName.trim(),
        description: formDesc.trim() || null,
        discount_type: formDiscountType,
        discount_value: Number(formDiscountValue),
        start_date: new Date(formStartDate).toISOString(),
        end_date: new Date(formEndDate).toISOString(),
        status: 'active',
      })
      .select('offer_id')
      .single()

    if (offerError || !offer) {
      setError('Failed to create offer.')
      setSubmitting(false)
      return
    }

    // [OFFERS] Insert offer_skus rows with original_price snapshot
    const offerSkuRows = formSelectedSKUs.map((sku_id) => {
      const sku = skuOptions.find((s) => s.sku_id === sku_id)
      return {
        offer_id: offer.offer_id,
        sku_id,
        original_price: sku?.price ?? 0,
      }
    })

    const { error: skuError } = await supabase.from('offer_skus').insert(offerSkuRows)
    if (skuError) {
      setError('Offer created but failed to link SKUs.')
      setSubmitting(false)
      return
    }

    // [OFFERS] Notify all distributors via edge function
    const selectedSkuNames = skuOptions
      .filter((s) => formSelectedSKUs.includes(s.sku_id))
      .map((s) => s.name)

    await supabase.functions.invoke('notify-new-offer', {
      body: {
        offer_name: formName.trim(),
        offer_description: formDesc.trim() || null,
        sku_names: selectedSkuNames,
      },
    })

    resetForm()
    setCreateModalOpen(false)
    setSubmitting(false)
    fetchOffers()
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    const { error } = await supabase
      .from('offers')
      .update({ status: 'deactivated' })
      .eq('offer_id', deactivateTarget.offer_id)

    if (error) { console.error(error); return }
    setDeactivateTarget(null)
    fetchOffers()
  }

  const columns: ColumnDef<OfferRow>[] = [
    { header: 'Sr No.', cell: ({ row }) => row.index + 1 },
    { header: 'Offer Name', accessorKey: 'name' },
    {
      header: 'SKUs',
      accessorKey: 'sku_names',
      cell: ({ getValue }) => {
        const names = getValue() as string[]
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((n) => (
              <span key={n} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{n}</span>
            ))}
          </div>
        )
      },
    },
    {
      header: 'Discount',
      cell: ({ row }) =>
        row.original.discount_type === 'percent'
          ? `${row.original.discount_value}%`
          : `₹${row.original.discount_value}`,
    },
    { header: 'Start', accessorKey: 'start_date' },
    { header: 'End', accessorKey: 'end_date' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as any} />,
    },
    {
      header: 'Action',
      cell: ({ row }) =>
        row.original.status === 'active' ? (
          <button
            onClick={() => setDeactivateTarget(row.original)}
            className="text-xs text-red-500 hover:underline"
          >
            Deactivate
          </button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Offers</h1>
          <button
            onClick={() => { resetForm(); setCreateModalOpen(true) }}
            className="px-4 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
          >
            Create Offer
          </button>
        </div>

        <DataTable
          columns={columns}
          data={offers}
          loading={loading}
          searchable
          exportable
          exportFilename="offers"
          emptyMessage="No offers yet"
        />
      </div>

      {/* Create Offer Modal */}
      <Modal open={createModalOpen} title="Create Offer" onClose={() => { setCreateModalOpen(false); resetForm() }}>
        <div className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Offer Name</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Summer Sale" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Brief description sent to distributors..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#eb2030]"
            />
          </div>

          {/* [OFFERS] SKU multi-select — checkboxes */}
          <div>
            <label className={labelClass}>Select SKUs</label>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-50">
              {skuOptions.map((sku) => (
                <label
                  key={sku.sku_id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formSelectedSKUs.includes(sku.sku_id)}
                    onChange={() => toggleSKU(sku.sku_id)}
                    className="accent-[#eb2030]"
                  />
                  <span className="text-sm text-gray-800 flex-1">{sku.name}</span>
                  <span className="text-xs text-gray-400">₹{sku.price}/pc</span>
                </label>
              ))}
            </div>
            {formSelectedSKUs.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{formSelectedSKUs.length} SKU{formSelectedSKUs.length > 1 ? 's' : ''} selected</p>
            )}
          </div>

          {/* [OFFERS] Discount type toggle */}
          <div>
            <label className={labelClass}>Discount Type</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setFormDiscountType('percent')}
                className={`flex-1 py-2 text-sm transition-colors ${formDiscountType === 'percent' ? 'bg-[#eb2030] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Percent (%)
              </button>
              <button
                onClick={() => setFormDiscountType('value')}
                className={`flex-1 py-2 text-sm transition-colors ${formDiscountType === 'value' ? 'bg-[#eb2030] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Fixed Value (₹)
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {formDiscountType === 'percent' ? 'Discount (%)' : 'Discount (₹ per pc)'}
            </label>
            <input
              type="number"
              value={formDiscountValue}
              onChange={(e) => setFormDiscountValue(e.target.value)}
              placeholder={formDiscountType === 'percent' ? 'e.g. 10' : 'e.g. 5'}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="datetime-local" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="datetime-local" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-[#eb2030] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c4001a] transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? 'Creating...' : 'Create Offer'}
          </button>
        </div>
      </Modal>

      {/* Deactivate confirm modal */}
      <Modal open={!!deactivateTarget} title="Deactivate Offer" onClose={() => setDeactivateTarget(null)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to deactivate{' '}
            <span className="font-medium text-gray-900">{deactivateTarget?.name}</span>?
            Prices will revert to original for all affected SKUs.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeactivateTarget(null)}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              className="flex-1 py-2 text-sm bg-[#eb2030] text-white rounded-lg hover:bg-[#c4001a] transition-colors"
            >
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}