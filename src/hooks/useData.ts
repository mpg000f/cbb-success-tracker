import { useState, useEffect, useCallback } from 'react'
import type { SchoolRecord, CoachRecord, SeasonRecord, SimilarResult, SimilarMode, PowerRatings } from '../types'

const BASE = import.meta.env.BASE_URL

export function useData() {
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [seasons, setSeasons] = useState<SeasonRecord[]>([])
  const [powerRatings, setPowerRatings] = useState<PowerRatings>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/schools.json`).then(r => r.json()),
      fetch(`${BASE}data/seasons.json`).then(r => r.json()),
      fetch(`${BASE}data/power_ratings.json`).then(r => r.json()).catch(() => ({})),
    ]).then(([s, sea, pr]) => {
      setSchools(s)
      setSeasons(sea)
      setPowerRatings(pr)
      setLoading(false)
    })
  }, [])

  const getFilteredSchools = useCallback((yearStart: number, yearEnd: number, search: string, conference = ''): SchoolRecord[] => {
    const q = search.toLowerCase()
    const filtered = seasons.filter(s => s.year >= yearStart && s.year <= yearEnd)

    const bySchool = new Map<string, SchoolRecord>()
    for (const s of filtered) {
      const existing = bySchool.get(s.school)
      if (existing) {
        existing.wins += s.wins
        existing.losses += s.losses
        existing.tournamentApps += s.tournamentApp
        existing.sweet16 += s.sweet16
        existing.elite8 += s.elite8
        existing.finalFour += s.finalFour
        existing.champGame += s.champGame
        existing.titles += s.title
        existing.confRegularSeason += s.confRegSeason
        existing.confTournament += s.confTourney
      } else {
        const schoolMeta = schools.find(sc => sc.school === s.school)
        bySchool.set(s.school, {
          school: s.school,
          espnId: s.espnId,
          conference: schoolMeta?.conference ?? '',
          wins: s.wins,
          losses: s.losses,
          winPct: 0,
          tournamentApps: s.tournamentApp,
          sweet16: s.sweet16,
          elite8: s.elite8,
          finalFour: s.finalFour,
          champGame: s.champGame,
          titles: s.title,
          confRegularSeason: s.confRegSeason,
          confTournament: s.confTourney,
        })
      }
    }
    for (const s of bySchool.values()) {
      const total = s.wins + s.losses
      s.winPct = total > 0 ? Math.round((s.wins / total) * 1000) / 1000 : 0
    }

    return [...bySchool.values()]
      .filter(s => s.school.toLowerCase().includes(q))
      .filter(s => !conference || s.conference === conference)
  }, [seasons, schools])

  const getFilteredCoaches = useCallback((yearStart: number, yearEnd: number, search: string): CoachRecord[] => {
    const q = search.toLowerCase()
    const filtered = seasons.filter(s => s.year >= yearStart && s.year <= yearEnd)

    const byCoachSchool = new Map<string, { school: string; espnId: number; startYear: number; endYear: number }>()
    const byCoach = new Map<string, CoachRecord>()

    for (const s of filtered) {
      const stintKey = `${s.coach}|||${s.school}`
      const stint = byCoachSchool.get(stintKey)
      if (stint) {
        stint.startYear = Math.min(stint.startYear, s.year)
        stint.endYear = Math.max(stint.endYear, s.year)
      } else {
        byCoachSchool.set(stintKey, { school: s.school, espnId: s.espnId, startYear: s.year, endYear: s.year })
      }

      const existing = byCoach.get(s.coach)
      if (existing) {
        existing.wins += s.wins
        existing.losses += s.losses
        existing.tournamentApps += s.tournamentApp
        existing.sweet16 += s.sweet16
        existing.elite8 += s.elite8
        existing.finalFour += s.finalFour
        existing.champGame += s.champGame
        existing.titles += s.title
        existing.confRegularSeason += s.confRegSeason
        existing.confTournament += s.confTourney
        existing.startYear = Math.min(existing.startYear, s.year)
        existing.endYear = Math.max(existing.endYear, s.year)
      } else {
        byCoach.set(s.coach, {
          coach: s.coach,
          school: '',
          espnId: s.espnId,
          schoolLogos: [],
          years: '',
          startYear: s.year,
          endYear: s.year,
          wins: s.wins,
          losses: s.losses,
          winPct: 0,
          tournamentApps: s.tournamentApp,
          sweet16: s.sweet16,
          elite8: s.elite8,
          finalFour: s.finalFour,
          champGame: s.champGame,
          titles: s.title,
          confRegularSeason: s.confRegSeason,
          confTournament: s.confTourney,
        })
      }
    }

    for (const c of byCoach.values()) {
      const total = c.wins + c.losses
      c.winPct = total > 0 ? Math.round((c.wins / total) * 1000) / 1000 : 0

      const stints = [...byCoachSchool.entries()]
        .filter(([k]) => k.startsWith(c.coach + '|||'))
        .map(([, v]) => v)
        .sort((a, b) => a.startYear - b.startYear)

      c.schoolLogos = stints.map(s => ({ school: s.school, espnId: s.espnId }))
      c.school = stints.map(s => s.school).join(', ')
      c.espnId = stints[stints.length - 1]?.espnId ?? 0
      c.years = `${c.startYear}-${c.endYear}`
    }

    return [...byCoach.values()].filter(c =>
      c.coach.toLowerCase().includes(q) || c.school.toLowerCase().includes(q)
    )
  }, [seasons])

  const findSimilar = useCallback((
    query: string,
    yearStart: number,
    yearEnd: number,
    mode: SimilarMode = 'schools',
    singleSeason = false,
    useEfficiency = false,
  ): SimilarResult[] => {
    const windowLen = singleSeason ? 1 : yearEnd - yearStart + 1
    const effectiveYearEnd = singleSeason ? yearStart : yearEnd

    const statKeys = ['wins', 'losses', 'winPct', 'tournamentApps', 'sweet16', 'elite8', 'finalFour', 'champGame', 'titles', 'confRegularSeason', 'confTournament'] as const

    const aggregate = (school: string, start: number, end: number): SchoolRecord | null => {
      const matching = seasons.filter(s => s.school === school && s.year >= start && s.year <= end)
      if (matching.length === 0) return null
      const rec: SchoolRecord = {
        school, espnId: matching[0].espnId, conference: '',
        wins: 0, losses: 0, winPct: 0, tournamentApps: 0, sweet16: 0,
        elite8: 0, finalFour: 0, champGame: 0, titles: 0,
        confRegularSeason: 0, confTournament: 0,
      }
      for (const s of matching) {
        rec.wins += s.wins; rec.losses += s.losses
        rec.tournamentApps += s.tournamentApp; rec.sweet16 += s.sweet16
        rec.elite8 += s.elite8; rec.finalFour += s.finalFour
        rec.champGame += s.champGame; rec.titles += s.title
        rec.confRegularSeason += s.confRegSeason; rec.confTournament += s.confTourney
      }
      const total = rec.wins + rec.losses
      rec.winPct = total > 0 ? Math.round((rec.wins / total) * 1000) / 1000 : 0
      return rec
    }

    const avgEffMargin = (espnId: number, start: number, end: number): number | undefined => {
      if (!useEfficiency) return undefined
      let sum = 0, count = 0
      for (let y = start; y <= end; y++) {
        const val = powerRatings[String(y)]?.[String(espnId)]
        if (val !== undefined) { sum += val; count++ }
      }
      return count > 0 ? Math.round((sum / count) * 10) / 10 : undefined
    }

    type Window = {
      school: string; espnId: number; yearStart: number; yearEnd: number
      stats: SchoolRecord; coach?: string
      schoolLogos?: { school: string; espnId: number }[]
      effMargin?: number
    }

    const allYears = seasons.map(s => s.year)
    const minYear = Math.min(...allYears)
    const maxYear = Math.max(...allYears)

    if (mode === 'schools') {
      const queryStats = aggregate(query, yearStart, effectiveYearEnd)
      if (!queryStats) return []
      const queryEff = avgEffMargin(queryStats.espnId, yearStart, effectiveYearEnd)

      const allSchools = [...new Set(seasons.map(s => s.school))].filter(s => s !== query)
      const windows: Window[] = [{
        school: query, espnId: queryStats.espnId, yearStart, yearEnd: effectiveYearEnd,
        stats: queryStats, effMargin: queryEff,
      }]

      for (const school of allSchools) {
        const schoolSeasons = seasons.filter(s => s.school === school).map(s => s.year)
        if (schoolSeasons.length === 0) continue
        const schoolMin = Math.min(...schoolSeasons)
        const schoolMax = Math.max(...schoolSeasons)
        let bestWindow: Window | null = null
        let bestDist = Infinity

        for (let start = Math.max(minYear, schoolMin); start + windowLen - 1 <= Math.min(maxYear, schoolMax); start++) {
          const end = start + windowLen - 1
          const stats = aggregate(school, start, end)
          if (!stats) continue
          let rawDist = 0
          for (const k of statKeys) rawDist += (stats[k] - queryStats[k]) ** 2
          if (rawDist < bestDist) {
            bestDist = rawDist
            bestWindow = {
              school, espnId: stats.espnId, yearStart: start, yearEnd: end,
              stats, effMargin: avgEffMargin(stats.espnId, start, end),
            }
          }
        }
        if (bestWindow) windows.push(bestWindow)
      }

      return normalizeAndRank(windows, query, statKeys, useEfficiency)
    }

    // Coach mode
    const queryCoach = query.split('|||')[0]
    const querySchool = query.split('|||')[1]

    // Get all seasons for this coach at this school
    const querySeasons = seasons
      .filter(s => s.coach === queryCoach && s.school === querySchool)
      .sort((a, b) => a.year - b.year)
    if (querySeasons.length === 0) return []

    const queryStart = singleSeason ? yearStart : Math.max(yearStart, querySeasons[0].year)
    const queryEnd = singleSeason ? yearStart : Math.min(effectiveYearEnd, querySeasons[querySeasons.length - 1].year)
    const queryWindow = queryEnd - queryStart + 1
    if (queryWindow < 1) return []

    const queryStats = aggregate(querySchool, queryStart, queryEnd)
    if (!queryStats) return []
    const queryEspnId = querySeasons[0].espnId
    const queryEff = avgEffMargin(queryEspnId, queryStart, queryEnd)

    const windows: Window[] = [{
      school: querySchool, espnId: queryEspnId, yearStart: queryStart, yearEnd: queryEnd,
      stats: queryStats, coach: queryCoach,
      schoolLogos: [{ school: querySchool, espnId: queryEspnId }],
      effMargin: queryEff,
    }]

    // Build stints: each coach+school combination
    const stintMap = new Map<string, { coach: string; school: string; espnId: number; years: number[] }>()
    for (const s of seasons) {
      const key = `${s.coach}|||${s.school}`
      const existing = stintMap.get(key)
      if (existing) {
        existing.years.push(s.year)
      } else {
        stintMap.set(key, { coach: s.coach, school: s.school, espnId: s.espnId, years: [s.year] })
      }
    }

    const queryKey = `${queryCoach}|||${querySchool}`
    for (const [key, stint] of stintMap) {
      if (key === queryKey) continue
      stint.years.sort((a, b) => a - b)
      if (stint.years.length < queryWindow) continue

      let bestWindow: Window | null = null
      let bestDist = Infinity

      for (let i = 0; i <= stint.years.length - queryWindow; i++) {
        const start = stint.years[i]
        const end = start + queryWindow - 1
        // Check that contiguous years exist in this stint
        if (stint.years[i + queryWindow - 1] !== end) continue
        const stats = aggregate(stint.school, start, end)
        if (!stats) continue
        let rawDist = 0
        for (const k of statKeys) rawDist += (stats[k] - queryStats[k]) ** 2
        if (rawDist < bestDist) {
          bestDist = rawDist
          bestWindow = {
            school: stint.school, espnId: stint.espnId,
            yearStart: start, yearEnd: end, stats,
            coach: stint.coach,
            schoolLogos: [{ school: stint.school, espnId: stint.espnId }],
            effMargin: avgEffMargin(stint.espnId, start, end),
          }
        }
      }
      if (bestWindow) windows.push(bestWindow)
    }

    return normalizeAndRank(windows, queryKey, statKeys, useEfficiency, true)
  }, [seasons, powerRatings])

  return { schools, seasons, loading, powerRatings, getFilteredSchools, getFilteredCoaches, findSimilar }
}

function normalizeAndRank(
  windows: { school: string; espnId: number; yearStart: number; yearEnd: number; stats: SchoolRecord; coach?: string; schoolLogos?: { school: string; espnId: number }[]; effMargin?: number }[],
  queryId: string,
  statKeys: readonly string[],
  useEfficiency: boolean,
  isCoachMode = false,
): SimilarResult[] {
  const mins: Record<string, number> = {}
  const maxs: Record<string, number> = {}
  const allKeys = [...statKeys, ...(useEfficiency ? ['effMargin'] : [])]
  for (const k of allKeys) { mins[k] = Infinity; maxs[k] = -Infinity }

  for (const w of windows) {
    for (const k of statKeys) {
      const v = w.stats[k as keyof SchoolRecord] as number
      if (v < mins[k]) mins[k] = v
      if (v > maxs[k]) maxs[k] = v
    }
    if (useEfficiency && w.effMargin !== undefined) {
      if (w.effMargin < mins['effMargin']) mins['effMargin'] = w.effMargin
      if (w.effMargin > maxs['effMargin']) maxs['effMargin'] = w.effMargin
    }
  }

  const queryWindow = windows[0]
  const queryNorm: Record<string, number> = {}
  for (const k of statKeys) {
    const range = maxs[k] - mins[k]
    queryNorm[k] = range > 0 ? ((queryWindow.stats[k as keyof SchoolRecord] as number) - mins[k]) / range : 0
  }
  if (useEfficiency && queryWindow.effMargin !== undefined) {
    const range = maxs['effMargin'] - mins['effMargin']
    queryNorm['effMargin'] = range > 0 ? (queryWindow.effMargin - mins['effMargin']) / range : 0
  }

  const results: SimilarResult[] = []
  for (const w of windows.slice(1)) {
    const matchId = isCoachMode ? `${w.coach}|||${w.school}` : w.school
    if (matchId === queryId) continue
    let dist = 0
    for (const k of statKeys) {
      const range = maxs[k] - mins[k]
      const norm = range > 0 ? ((w.stats[k as keyof SchoolRecord] as number) - mins[k]) / range : 0
      dist += (norm - queryNorm[k]) ** 2
    }
    if (useEfficiency && w.effMargin !== undefined && queryWindow.effMargin !== undefined) {
      const range = maxs['effMargin'] - mins['effMargin']
      const norm = range > 0 ? (w.effMargin - mins['effMargin']) / range : 0
      dist += (norm - queryNorm['effMargin']) ** 2
    }
    dist = Math.sqrt(dist)
    results.push({
      school: w.school, espnId: w.espnId,
      yearStart: w.yearStart, yearEnd: w.yearEnd,
      distance: dist, stats: w.stats,
      coach: w.coach, schoolLogos: w.schoolLogos,
      effMargin: w.effMargin,
    })
  }

  results.sort((a, b) => a.distance - b.distance)
  return results.slice(0, 15)
}
