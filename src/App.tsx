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
    const fullRange = filters.yearStart <= 1985 && filters.yearEnd >= 2025

    if (fullRange) {
      return schools.filter(s => s.school.toLowerCase().includes(q))
    }

    // When year range is narrowed, aggregate from coach data
    const coachesInRange = coaches.filter(c =>
      c.startYear <= filters.yearEnd && c.endYear >= filters.yearStart
    )
    const bySchool = new Map<string, typeof schools[number]>()
    for (const c of coachesInRange) {
      const existing = bySchool.get(c.school)
      if (existing) {
        existing.wins += c.wins
        existing.losses += c.losses
        existing.tournamentApps += c.tournamentApps
        existing.sweet16 += c.sweet16
        existing.elite8 += c.elite8
        existing.finalFour += c.finalFour
        existing.champGame += c.champGame
        existing.titles += c.titles
        existing.confRegularSeason += c.confRegularSeason
        existing.confTournament += c.confTournament
      } else {
        const schoolRecord = schools.find(s => s.school === c.school)
        bySchool.set(c.school, {
          school: c.school,
          espnId: c.espnId,
          conference: schoolRecord?.conference ?? '',
          wins: c.wins,
          losses: c.losses,
          winPct: 0,
          tournamentApps: c.tournamentApps,
          sweet16: c.sweet16,
          elite8: c.elite8,
          finalFour: c.finalFour,
          champGame: c.champGame,
          titles: c.titles,
          confRegularSeason: c.confRegularSeason,
          confTournament: c.confTournament,
        })
      }
    }
    for (const s of bySchool.values()) {
      const total = s.wins + s.losses
      s.winPct = total > 0 ? Math.round((s.wins / total) * 1000) / 1000 : 0
    }

    return [...bySchool.values()].filter(s => s.school.toLowerCase().includes(q))
  }, [schools, coaches, filters])

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
