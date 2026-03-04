import type { Filters as FiltersType, ViewMode } from '../types'

interface Props {
  filters: FiltersType
  setFilters: (f: FiltersType) => void
  conferences: string[]
  view: ViewMode
}

const currentYear = new Date().getFullYear()
// Season spans two calendar years (e.g. 2025-26 season = year 2026)
// During a season (Oct-Apr), include the upcoming ending year
const maxYear = new Date().getMonth() >= 9 ? currentYear + 1 : currentYear
const years = Array.from({ length: maxYear - 1985 + 1 }, (_, i) => 1985 + i)

export function Filters({ filters, setFilters, conferences, view }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          type="text"
          placeholder="Search by school or coach..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {view === 'schools' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conference</label>
          <select
            value={filters.conference}
            onChange={e => setFilters({ ...filters, conference: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Conferences</option>
            {conferences.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
        <select
          value={filters.yearStart}
          onChange={e => setFilters({ ...filters, yearStart: Number(e.target.value) })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
        <select
          value={filters.yearEnd}
          onChange={e => setFilters({ ...filters, yearEnd: Number(e.target.value) })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  )
}
