import { useState, useMemo } from 'react'
import { Header } from './components/Header'
import { Filters } from './components/Filters'
import { SchoolTable } from './components/SchoolTable'
import { CoachTable } from './components/CoachTable'
import { ComparePage } from './components/ComparePage'
import { useData } from './hooks/useData'
import type { ViewMode, Filters as FiltersType } from './types'

function App() {
  const { schools, coaches, loading } = useData()
  const [view, setView] = useState<ViewMode>('schools')
  const [filters, setFilters] = useState<FiltersType>({
    search: '',
    yearStart: 1985,
    yearEnd: 2025,
  })

  const filteredSchools = useMemo(() => {
    const q = filters.search.toLowerCase()
    return schools.filter(s => s.school.toLowerCase().includes(q))
  }, [schools, filters.search])

  const filteredCoaches = useMemo(() => {
    const q = filters.search.toLowerCase()
    return coaches.filter(c => {
      const matchesSearch = c.coach.toLowerCase().includes(q) || c.school.toLowerCase().includes(q)
      const overlaps = c.startYear <= filters.yearEnd && c.endYear >= filters.yearStart
      return matchesSearch && overlaps
    })
  }, [coaches, filters])

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
        {view !== 'compare' && (
          <Filters filters={filters} setFilters={setFilters} />
        )}
        {view === 'schools' && <SchoolTable data={filteredSchools} />}
        {view === 'coaches' && <CoachTable data={filteredCoaches} />}
        {view === 'compare' && <ComparePage schools={schools} coaches={coaches} />}
      </main>
    </div>
  )
}

export default App
