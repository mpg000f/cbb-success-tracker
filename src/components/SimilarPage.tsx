import { useState, useMemo } from 'react'
import type { SchoolRecord, SimilarResult } from '../types'
import { LogoCell } from './LogoCell'

interface Props {
  schools: SchoolRecord[]
  findSimilar: (querySchool: string, yearStart: number, yearEnd: number) => SimilarResult[]
  getFilteredSchools: (yearStart: number, yearEnd: number, search: string) => SchoolRecord[]
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

export function SimilarPage({ schools, findSimilar, getFilteredSchools }: Props) {
  const [search, setSearch] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState(false)
  const [yearStart, setYearStart] = useState(2000)
  const [yearEnd, setYearEnd] = useState(2020)

  const suggestions = useMemo(() => {
    if (!search || selectedSchool) return []
    const q = search.toLowerCase()
    return schools.filter(s => s.school.toLowerCase().includes(q)).slice(0, 8)
  }, [search, selectedSchool, schools])

  const results = useMemo(() => {
    if (!selectedSchool) return null
    return findSimilar(selectedSchool, yearStart, yearEnd)
  }, [selectedSchool, yearStart, yearEnd, findSimilar])

  const bestMatch = results?.[0] ?? null

  const querySchoolStats = useMemo(() => {
    if (!selectedSchool) return null
    const filtered = getFilteredSchools(yearStart, yearEnd, '')
    return filtered.find(s => s.school === selectedSchool) ?? null
  }, [selectedSchool, yearStart, yearEnd, getFilteredSchools])

  const fmt = (key: string, v: number) => key === 'winPct' ? v.toFixed(3) : String(v)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="relative flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedSchool(null) }}
            onFocus={() => setFocusedInput(true)}
            onBlur={() => setTimeout(() => setFocusedInput(false), 200)}
            placeholder="Search schools..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {suggestions.length > 0 && focusedInput && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <li
                  key={s.school}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  onMouseDown={() => { setSelectedSchool(s.school); setSearch(s.school) }}
                >
                  {s.school}
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
      </div>

      {!selectedSchool && (
        <div className="text-center py-12 text-gray-400">
          Select a school and year range to find programs with the most similar statistical profile.
        </div>
      )}

      {selectedSchool && results && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No results found. Try a different school or year range.
        </div>
      )}

      {bestMatch && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">
            Best Match
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left text-gray-700 w-1/3">
                    <LogoCell espnId={querySchoolStats?.espnId ?? 0} name={selectedSchool ?? ''} />
                    <div className="text-xs text-gray-500 mt-1 ml-10">{yearStart}-{yearEnd}</div>
                  </th>
                  <th className="px-4 py-3 text-center text-gray-500 w-1/3">Stat</th>
                  <th className="px-4 py-3 text-right text-gray-700 w-1/3">
                    <div className="flex items-center justify-end">
                      <LogoCell espnId={bestMatch.espnId} name={bestMatch.school} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {bestMatch.yearStart}-{bestMatch.yearEnd}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {statLabels.map(({ key, label }) => {
                  const valQuery = querySchoolStats ? (querySchoolStats[key] as number) : 0
                  const valMatch = bestMatch.stats[key] as number
                  return (
                    <tr key={key} className="border-b border-gray-100 even:bg-gray-50">
                      <td className="px-4 py-2 text-left font-mono">{fmt(key, valQuery)}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{label}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(key, valMatch)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {results && results.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">Top 15 Similar Programs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-3 py-2 text-gray-700">#</th>
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
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.school}-${r.yearStart}`} className="border-b border-gray-100 even:bg-gray-50 hover:bg-blue-50">
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2">
                      <LogoCell espnId={r.espnId} name={r.school} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.yearStart}-{r.yearEnd}</td>
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
