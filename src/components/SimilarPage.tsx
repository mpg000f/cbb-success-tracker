import { useState, useMemo } from 'react'
import type { SchoolRecord, CoachRecord, SimilarResult, SimilarMode, PowerRatings } from '../types'
import { LogoCell } from './LogoCell'

interface Props {
  schools: SchoolRecord[]
  coaches: CoachRecord[]
  findSimilar: (query: string, yearStart: number, yearEnd: number, mode: SimilarMode, singleSeason: boolean, useSRS: boolean) => SimilarResult[]
  getFilteredSchools: (yearStart: number, yearEnd: number, search: string) => SchoolRecord[]
  getFilteredCoaches: (yearStart: number, yearEnd: number, search: string) => CoachRecord[]
  powerRatings: PowerRatings
}

const currentYear = new Date().getFullYear()
const maxYear = new Date().getMonth() >= 9 ? currentYear + 1 : currentYear
const years = Array.from({ length: maxYear - 1985 + 1 }, (_, i) => 1985 + i)

const statLabels: { key: keyof SchoolRecord; label: string }[] = [
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'winPct', label: 'Win %' },
  { key: 'tournamentApps', label: 'Tourney Apps' },
  { key: 'sweet16', label: 'Sweet 16' },
  { key: 'elite8', label: 'Elite 8' },
  { key: 'finalFour', label: 'Final Four' },
  { key: 'champGame', label: 'Champ Game' },
  { key: 'titles', label: 'Titles' },
  { key: 'confRegularSeason', label: 'Conf Reg Season' },
  { key: 'confTournament', label: 'Conf Tourney' },
]

export function SimilarPage({ schools, coaches, findSimilar, getFilteredSchools, getFilteredCoaches, powerRatings }: Props) {
  const [mode, setMode] = useState<SimilarMode>('schools')
  const [search, setSearch] = useState('')
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState(false)
  const [yearStart, setYearStart] = useState(2000)
  const [yearEnd, setYearEnd] = useState(2020)
  const [singleSeason, setSingleSeason] = useState(false)
  const [useSRS, setUseSRS] = useState(true)

  const searchItems = useMemo(() => {
    if (mode === 'schools') {
      return schools.map(s => ({ id: s.school, label: s.school }))
    }
    return coaches.map(c => ({ id: `${c.coach}|||${c.school}`, label: `${c.coach} (${c.school}, ${c.years})` }))
  }, [mode, schools, coaches])

  const suggestions = useMemo(() => {
    if (!search || selectedQuery) return []
    const q = search.toLowerCase()
    return searchItems.filter(i => i.label.toLowerCase().includes(q)).slice(0, 8)
  }, [search, selectedQuery, searchItems])

  const results = useMemo(() => {
    if (!selectedQuery) return null
    return findSimilar(selectedQuery, yearStart, yearEnd, mode, singleSeason, useSRS)
  }, [selectedQuery, yearStart, yearEnd, mode, singleSeason, useSRS, findSimilar])

  const bestMatch = results?.[0] ?? null

  const queryStats = useMemo(() => {
    if (!selectedQuery) return null
    const effectiveEnd = singleSeason ? yearStart : yearEnd
    if (mode === 'schools') {
      const filtered = getFilteredSchools(yearStart, effectiveEnd, '')
      return filtered.find(s => s.school === selectedQuery) ?? null
    }
    const [coach, school] = selectedQuery.split('|||')
    const filtered = getFilteredCoaches(yearStart, effectiveEnd, '')
    return filtered.find(c => c.coach === coach && c.school.includes(school)) ?? null
  }, [selectedQuery, yearStart, yearEnd, singleSeason, mode, getFilteredSchools, getFilteredCoaches])

  const queryEspnId = queryStats?.espnId ?? 0
  const querySRS = useMemo(() => {
    if (!queryEspnId || !useSRS) return undefined
    const start = yearStart
    const end = singleSeason ? yearStart : yearEnd
    let sum = 0, count = 0
    for (let y = start; y <= end; y++) {
      const val = powerRatings[String(y)]?.[String(queryEspnId)]
      if (val !== undefined) { sum += val; count++ }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : undefined
  }, [queryEspnId, yearStart, yearEnd, singleSeason, useSRS, powerRatings])
  const queryDisplayName = mode === 'coaches' && selectedQuery
    ? selectedQuery.split('|||')[0]
    : selectedQuery ?? ''
  const querySchoolName = mode === 'coaches' && selectedQuery
    ? selectedQuery.split('|||')[1]
    : ''

  const fmt = (key: string, v: number) => key === 'winPct' ? v.toFixed(3) : String(v)
  const srsFmt = (v?: number) => v !== undefined ? v.toFixed(1) : '—'

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-gray-700">Find similar:</span>
        <button
          onClick={() => { setMode('schools'); setSelectedQuery(null); setSearch('') }}
          className={`px-3 py-1 text-sm rounded-md cursor-pointer ${mode === 'schools' ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Schools
        </button>
        <button
          onClick={() => { setMode('coaches'); setSelectedQuery(null); setSearch('') }}
          className={`px-3 py-1 text-sm rounded-md cursor-pointer ${mode === 'coaches' ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Coaches
        </button>
      </div>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="relative flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mode === 'schools' ? 'School' : 'Coach'}
          </label>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedQuery(null) }}
            onFocus={() => setFocusedInput(true)}
            onBlur={() => setTimeout(() => setFocusedInput(false), 200)}
            placeholder={`Search ${mode}...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {suggestions.length > 0 && focusedInput && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <li
                  key={s.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  onMouseDown={() => { setSelectedQuery(s.id); setSearch(s.label) }}
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <select
            value={yearStart}
            onChange={e => setYearStart(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {!singleSeason && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <select
              value={yearEnd}
              onChange={e => setYearEnd(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={singleSeason}
            onChange={e => setSingleSeason(e.target.checked)}
            className="rounded"
          />
          Single season
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={useSRS}
            onChange={e => setUseSRS(e.target.checked)}
            className="rounded"
          />
          Include SRS
        </label>
      </div>

      {!selectedQuery && (
        <div className="text-center py-12 text-gray-400">
          Select a {mode === 'schools' ? 'school' : 'coach'} and year range to find the most similar statistical profile.
        </div>
      )}

      {selectedQuery && results && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No results found. Try a different {mode === 'schools' ? 'school' : 'coach'} or year range.
        </div>
      )}

      {/* Best match table */}
      {bestMatch && queryStats && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">Best Match</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left text-gray-700 w-1/3">
                    <LogoCell espnId={queryEspnId} name={queryDisplayName} />
                    {mode === 'coaches' && (
                      <div className="text-xs text-gray-500 mt-1 ml-10">{querySchoolName}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 ml-10">
                      {yearStart}{!singleSeason && `-${yearEnd}`}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-gray-500 w-1/3">Stat</th>
                  <th className="px-4 py-3 text-right text-gray-700 w-1/3">
                    <div className="flex items-center justify-end">
                      <LogoCell espnId={bestMatch.espnId} name={mode === 'coaches' ? (bestMatch.coach ?? bestMatch.school) : bestMatch.school} />
                    </div>
                    {mode === 'coaches' && bestMatch.school && (
                      <div className="text-xs text-gray-500 mt-1 text-right">{bestMatch.school}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {bestMatch.yearStart}{bestMatch.yearStart !== bestMatch.yearEnd && `-${bestMatch.yearEnd}`}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {statLabels.map(({ key, label }) => {
                  const valQuery = queryStats[key as keyof typeof queryStats] as number
                  const valMatch = bestMatch.stats[key] as number
                  return (
                    <tr key={key} className="border-b border-gray-100 even:bg-gray-50">
                      <td className="px-4 py-2 text-left font-mono">{fmt(key, valQuery)}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{label}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(key, valMatch)}</td>
                    </tr>
                  )
                })}
                {useSRS && (
                  <tr className="border-b border-gray-100 even:bg-gray-50">
                    <td className="px-4 py-2 text-left font-mono">{srsFmt(querySRS)}</td>
                    <td className="px-4 py-2 text-center text-gray-500">SRS</td>
                    <td className="px-4 py-2 text-right font-mono">{srsFmt(bestMatch.effMargin)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Top 15 table */}
      {results && results.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">Top 15 Similar {mode === 'schools' ? 'Programs' : 'Coaching Stints'}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-3 py-2 text-gray-700">#</th>
                  {mode === 'coaches' && <th className="px-3 py-2 text-gray-700">Coach</th>}
                  <th className="px-3 py-2 text-gray-700">School</th>
                  <th className="px-3 py-2 text-gray-700">Era</th>
                  <th className="px-3 py-2 text-gray-700 text-right">Distance</th>
                  <th className="px-3 py-2 text-gray-700 text-right">W</th>
                  <th className="px-3 py-2 text-gray-700 text-right">L</th>
                  <th className="px-3 py-2 text-gray-700 text-right">Win%</th>
                  <th className="px-3 py-2 text-gray-700 text-right">T.Apps</th>
                  <th className="px-3 py-2 text-gray-700 text-right">S16</th>
                  <th className="px-3 py-2 text-gray-700 text-right">E8</th>
                  <th className="px-3 py-2 text-gray-700 text-right">F4</th>
                  <th className="px-3 py-2 text-gray-700 text-right">CG</th>
                  <th className="px-3 py-2 text-gray-700 text-right">Titles</th>
                  {useSRS && <th className="px-3 py-2 text-gray-700 text-right">SRS</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.coach ?? r.school}-${r.yearStart}`} className="border-b border-gray-100 even:bg-gray-50 hover:bg-blue-50">
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    {mode === 'coaches' && (
                      <td className="px-3 py-2 whitespace-nowrap">{r.coach}</td>
                    )}
                    <td className="px-3 py-2">
                      <LogoCell espnId={r.espnId} name={r.school} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.yearStart}{r.yearStart !== r.yearEnd && `-${r.yearEnd}`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{r.distance.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.wins}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.losses}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.winPct.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.tournamentApps}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.sweet16}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.elite8}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.finalFour}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.champGame}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stats.titles}</td>
                    {useSRS && (
                      <td className="px-3 py-2 text-right font-mono">{srsFmt(r.effMargin)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
