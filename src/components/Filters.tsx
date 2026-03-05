import { useState, useRef, useEffect } from 'react'
import type { Filters as FiltersType, ViewMode } from '../types'

interface Props {
  filters: FiltersType
  setFilters: (f: FiltersType) => void
  conferences: string[]
  view: ViewMode
}

const currentYear = new Date().getFullYear()
const maxYear = new Date().getMonth() >= 9 ? currentYear + 1 : currentYear
const years = Array.from({ length: maxYear - 1985 + 1 }, (_, i) => 1985 + i)

export function Filters({ filters, setFilters, conferences, view }: Props) {
  const [confOpen, setConfOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setConfOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleConf = (conf: string) => {
    const current = filters.conferences
    const next = current.includes(conf)
      ? current.filter(c => c !== conf)
      : [...current, conf]
    setFilters({ ...filters, conferences: next })
  }

  const confLabel = filters.conferences.length === 0
    ? 'All Conferences'
    : filters.conferences.length <= 2
      ? filters.conferences.join(', ')
      : `${filters.conferences.length} conferences`

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
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conference</label>
          <button
            onClick={() => setConfOpen(o => !o)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px] text-left flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="truncate">{confLabel}</span>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {confOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {filters.conferences.length > 0 && (
                <button
                  onClick={() => setFilters({ ...filters, conferences: [] })}
                  className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                >
                  Clear all
                </button>
              )}
              {conferences.map(c => (
                <label
                  key={c}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.conferences.includes(c)}
                    onChange={() => toggleConf(c)}
                    className="rounded"
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
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
