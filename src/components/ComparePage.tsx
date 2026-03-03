import { useState, useMemo } from 'react'
import type { SchoolRecord, CoachRecord } from '../types'
import { LogoCell } from './LogoCell'

type CompareMode = 'schools' | 'coaches'

interface Props {
  schools: SchoolRecord[]
  coaches: CoachRecord[]
}

const statLabels: { key: string; label: string }[] = [
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'winPct', label: 'Win %' },
  { key: 'tournamentApps', label: 'Tournament Apps' },
  { key: 'sweet16', label: 'Sweet 16' },
  { key: 'elite8', label: 'Elite 8' },
  { key: 'finalFour', label: 'Final Four' },
  { key: 'champGame', label: 'Championship Game' },
  { key: 'titles', label: 'Titles' },
  { key: 'confRegularSeason', label: 'Conf Regular Season' },
  { key: 'confTournament', label: 'Conf Tournament' },
]

export function ComparePage({ schools, coaches }: Props) {
  const [mode, setMode] = useState<CompareMode>('schools')
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [selectedA, setSelectedA] = useState<string | null>(null)
  const [selectedB, setSelectedB] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState<'a' | 'b' | null>(null)
  const [yearStart, setYearStart] = useState(1985)
  const [yearEnd, setYearEnd] = useState(2025)

  const filteredCoaches = useMemo(() =>
    coaches.filter(c => c.startYear <= yearEnd && c.endYear >= yearStart),
    [coaches, yearStart, yearEnd]
  )

  const filteredSchools = useMemo(() => {
    const fullRange = yearStart <= 1985 && yearEnd >= 2025
    if (fullRange) return schools

    const bySchool = new Map<string, SchoolRecord>()
    for (const c of filteredCoaches) {
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
          wins: c.wins, losses: c.losses, winPct: 0,
          tournamentApps: c.tournamentApps, sweet16: c.sweet16, elite8: c.elite8,
          finalFour: c.finalFour, champGame: c.champGame, titles: c.titles,
          confRegularSeason: c.confRegularSeason, confTournament: c.confTournament,
        })
      }
    }
    for (const s of bySchool.values()) {
      const total = s.wins + s.losses
      s.winPct = total > 0 ? Math.round((s.wins / total) * 1000) / 1000 : 0
    }
    return [...bySchool.values()]
  }, [schools, filteredCoaches, yearStart, yearEnd])

  const items = mode === 'schools'
    ? filteredSchools.map(s => ({ ...s, id: `${s.school}`, label: s.school }))
    : filteredCoaches.map(c => ({ ...c, id: `${c.coach}-${c.school}`, label: `${c.coach} (${c.school}, ${c.years})` }))

  const suggestionsA = useMemo(() => {
    if (!searchA || selectedA) return []
    const q = searchA.toLowerCase()
    return items.filter(i => i.label.toLowerCase().includes(q)).slice(0, 8)
  }, [searchA, selectedA, items])

  const suggestionsB = useMemo(() => {
    if (!searchB || selectedB) return []
    const q = searchB.toLowerCase()
    return items.filter(i => i.label.toLowerCase().includes(q)).slice(0, 8)
  }, [searchB, selectedB, items])

  const itemA = items.find(i => i.id === selectedA)
  const itemB = items.find(i => i.id === selectedB)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-gray-700">Compare:</span>
        <button
          onClick={() => { setMode('schools'); setSelectedA(null); setSelectedB(null); setSearchA(''); setSearchB('') }}
          className={`px-3 py-1 text-sm rounded-md cursor-pointer ${mode === 'schools' ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Schools
        </button>
        <button
          onClick={() => { setMode('coaches'); setSelectedA(null); setSelectedB(null); setSearchA(''); setSearchB('') }}
          className={`px-3 py-1 text-sm rounded-md cursor-pointer ${mode === 'coaches' ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Coaches
        </button>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="number"
            min={1985}
            max={2025}
            value={yearStart}
            onChange={e => { setYearStart(Number(e.target.value)); setSelectedA(null); setSelectedB(null); setSearchA(''); setSearchB('') }}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="number"
            min={1985}
            max={2025}
            value={yearEnd}
            onChange={e => { setYearEnd(Number(e.target.value)); setSelectedA(null); setSelectedB(null); setSearchA(''); setSearchB('') }}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mode === 'schools' ? 'School' : 'Coach'} A
          </label>
          <input
            type="text"
            value={searchA}
            onChange={e => { setSearchA(e.target.value); setSelectedA(null) }}
            onFocus={() => setFocusedInput('a')}
            onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
            placeholder={`Search ${mode}...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {suggestionsA.length > 0 && focusedInput === 'a' && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestionsA.map(s => (
                <li
                  key={s.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  onMouseDown={() => { setSelectedA(s.id); setSearchA(s.label) }}
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mode === 'schools' ? 'School' : 'Coach'} B
          </label>
          <input
            type="text"
            value={searchB}
            onChange={e => { setSearchB(e.target.value); setSelectedB(null) }}
            onFocus={() => setFocusedInput('b')}
            onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
            placeholder={`Search ${mode}...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {suggestionsB.length > 0 && focusedInput === 'b' && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestionsB.map(s => (
                <li
                  key={s.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  onMouseDown={() => { setSelectedB(s.id); setSearchB(s.label) }}
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {itemA && itemB && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left text-gray-700 w-1/3">
                  <LogoCell espnId={itemA.espnId} name={mode === 'coaches' ? `${(itemA as CoachRecord & {id: string; label: string}).coach}` : itemA.label} />
                  {mode === 'coaches' && <div className="text-xs text-gray-500 mt-1 ml-10">{(itemA as CoachRecord & {id: string; label: string}).school} ({(itemA as CoachRecord & {id: string; label: string}).years})</div>}
                </th>
                <th className="px-4 py-3 text-center text-gray-500 w-1/3">Stat</th>
                <th className="px-4 py-3 text-right text-gray-700 w-1/3">
                  <div className="flex items-center justify-end">
                    <LogoCell espnId={itemB.espnId} name={mode === 'coaches' ? `${(itemB as CoachRecord & {id: string; label: string}).coach}` : itemB.label} />
                  </div>
                  {mode === 'coaches' && <div className="text-xs text-gray-500 mt-1 text-right">{(itemB as CoachRecord & {id: string; label: string}).school} ({(itemB as CoachRecord & {id: string; label: string}).years})</div>}
                </th>
              </tr>
            </thead>
            <tbody>
              {statLabels.map(({ key, label }) => {
                const valA = (itemA as Record<string, unknown>)[key] as number
                const valB = (itemB as Record<string, unknown>)[key] as number
                const isHigherBetter = key !== 'losses'
                const aWins = isHigherBetter ? valA > valB : valA < valB
                const bWins = isHigherBetter ? valB > valA : valB < valA
                const fmt = key === 'winPct' ? (v: number) => v.toFixed(3) : (v: number) => String(v)
                return (
                  <tr key={key} className="border-b border-gray-100 even:bg-gray-50">
                    <td className={`px-4 py-2 text-left font-mono ${aWins ? 'text-green-700 font-bold' : ''}`}>
                      {fmt(valA)}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500">{label}</td>
                    <td className={`px-4 py-2 text-right font-mono ${bWins ? 'text-green-700 font-bold' : ''}`}>
                      {fmt(valB)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(!itemA || !itemB) && (
        <div className="text-center py-12 text-gray-400">
          Select two {mode} above to compare them side by side.
        </div>
      )}
    </div>
  )
}
