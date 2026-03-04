import { useState, useMemo } from 'react'
import { Header } from './components/Header'
import { Filters } from './components/Filters'
import { SchoolTable } from './components/SchoolTable'
import { CoachTable } from './components/CoachTable'
import { ComparePage } from './components/ComparePage'
import { SimilarPage } from './components/SimilarPage'
import { useData } from './hooks/useData'
import type { ViewMode, Filters as FiltersType } from './types'

function App() {
  const { loading, schools, getFilteredSchools, getFilteredCoaches, findSimilar, powerRatings } = useData()
  const [view, setView] = useState<ViewMode>('schools')
  const [filters, setFilters] = useState<FiltersType>({
    search: '',
    yearStart: 1985,
    yearEnd: new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    conference: '',
  })

  const conferences = useMemo(
    () => [...new Set(schools.map(s => s.conference))].filter(Boolean).sort(),
    [schools]
  )

  const filteredSchools = useMemo(
    () => getFilteredSchools(filters.yearStart, filters.yearEnd, filters.search, filters.conference),
    [getFilteredSchools, filters]
  )

  const filteredCoaches = useMemo(
    () => getFilteredCoaches(filters.yearStart, filters.yearEnd, filters.search),
    [getFilteredCoaches, filters]
  )

  // Unfiltered for compare page (it has its own year filters)
  const maxYear = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear()
  const allSchools = useMemo(
    () => getFilteredSchools(1985, maxYear, ''),
    [getFilteredSchools, maxYear]
  )

  const allCoaches = useMemo(
    () => getFilteredCoaches(1985, maxYear, ''),
    [getFilteredCoaches, maxYear]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading data...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header view={view} setView={setView} />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {view !== 'compare' && view !== 'similar' && (
          <Filters filters={filters} setFilters={setFilters} conferences={conferences} view={view} />
        )}
        {view === 'schools' && <SchoolTable data={filteredSchools} />}
        {view === 'coaches' && <CoachTable data={filteredCoaches} />}
        {view === 'compare' && (
          <ComparePage
            schools={allSchools}
            coaches={allCoaches}
            getFilteredSchools={getFilteredSchools}
            getFilteredCoaches={getFilteredCoaches}
          />
        )}
        {view === 'similar' && (
          <SimilarPage
            schools={allSchools}
            coaches={allCoaches}
            findSimilar={findSimilar}
            getFilteredSchools={getFilteredSchools}
            getFilteredCoaches={getFilteredCoaches}
            powerRatings={powerRatings}
          />
        )}
      </main>
    </div>
  )
}

export default App
