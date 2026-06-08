import { useState } from 'react'

export interface FilterValues {
  search?: string
  status?: string
  distributor?: string
  dateFrom?: string
  dateTo?: string
}

interface FilterBarProps {
  onFilter: (values: FilterValues) => void
  showStatus?: boolean
  showDistributor?: boolean
  showDateRange?: boolean
  distributors?: { id: string; name: string }[]
  statusOptions?: string[]
}

export default function FilterBar({
  onFilter,
  showStatus = false,
  showDistributor = false,
  showDateRange = false,
  distributors = [],
  statusOptions = [],
}: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<FilterValues>({})

  function handleChange(key: keyof FilterValues, value: string) {
    const updated = { ...values, [key]: value }
    setValues(updated)
    onFilter(updated)
  }

  function handleReset() {
    setValues({})
    onFilter({})
  }

  const hasFilters = Object.values(values).some((v) => v && v !== '')

  return (
    <div className="mb-4">

      {/* Mobile toggle button */}
      <div className="flex items-center gap-2 sm:hidden mb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            open || hasFilters
              ? 'border-[#eb2030] text-[#eb2030] bg-orange-50'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          ⚙ Filters
          {hasFilters && (
            <span className="bg-[#eb2030] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              !
            </span>
          )}
        </button>
        {hasFilters && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
            Reset
          </button>
        )}
      </div>

      {/* Filters — always visible on desktop, collapsible on mobile */}
      <div className={`flex-wrap items-center gap-2 ${open ? 'flex' : 'hidden'} sm:flex`}>

        {showStatus && statusOptions.length > 0 && (
          <select
            value={values.status ?? ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#eb2030]"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {showDistributor && distributors.length > 0 && (
          <select
            value={values.distributor ?? ''}
            onChange={(e) => handleChange('distributor', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#eb2030]"
          >
            <option value="">All Distributors</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {showDateRange && (
          <>
            <input
              type="date"
              value={values.dateFrom ?? ''}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#eb2030]"
            />
            <input
              type="date"
              value={values.dateTo ?? ''}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#eb2030]"
            />
          </>
        )}

        {hasFilters && (
          <button
            onClick={handleReset}
            className="hidden sm:block text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Reset
          </button>
        )}

      </div>
    </div>
  )
}