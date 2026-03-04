import { useState, useEffect, useCallback } from 'react'
import type { SchoolRecord, CoachRecord, SeasonRecord, SimilarResult } from '../types'

const BASE = import.meta.env.BASE_URL

export function useData() {
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [seasons, setSeasons] = useState<SeasonRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/schools.json`).then(r => r.json()),
      fetch(`${BASE}data/seasons.json`).then(r => r.json()),
    ]).then(([s, sea]) => {
      setSchools(s)
      setSeasons(sea)
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

    // First aggregate by coach+school stints
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

    // Build school display string and pick espnId from latest stint
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

  const findSimilar = useCallback((querySchool: string, yearStart: number, yearEnd: number): SimilarResult[] => {
    const windowLen = yearEnd - yearStart + 1
    const statKeys = ['wins', 'losses', 'winPct', 'tournamentApps', 'sweet16', 'elite8', 'finalFour', 'champGame', 'titles', 'confRegularSeason', 'confTournament'] as const

    // Aggregate a school's seasons over a year range into a SchoolRecord
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

    const queryStats = aggregate(querySchool, yearStart, yearEnd)
    if (!queryStats) return []

    // Get all unique schools except the query school
    const allSchools = [...new Set(seasons.map(s => s.school))].filter(s => s !== querySchool)

    // Get year range available in data
    const allYears = seasons.map(s => s.year)
    const minYear = Math.min(...allYears)
    const maxYear = Math.max(...allYears)

    // Build all windows: query + every other school's sliding windows
    type Window = { school: string; espnId: number; yearStart: number; yearEnd: number; stats: SchoolRecord }
    const windows: Window[] = [{ school: querySchool, espnId: queryStats.espnId, yearStart, yearEnd, stats: queryStats }]

    for (const school of allSchools) {
      const schoolSeasons = seasons.filter(s => s.school === school).map(s => s.year)
      if (schoolSeasons.length === 0) continue
      const schoolMin = Math.min(...schoolSeasons)
      const schoolMax = Math.max(...schoolSeasons)
      let bestWindow: Window | null = null
      let bestPlaceholder = Infinity

      for (let start = Math.max(minYear, schoolMin); start + windowLen - 1 <= Math.min(maxYear, schoolMax); start++) {
        const end = start + windowLen - 1
        const stats = aggregate(school, start, end)
        if (!stats) continue
        // Quick pre-filter: just use raw distance for best-per-school tracking
        let rawDist = 0
        for (const k of statKeys) rawDist += (stats[k] - queryStats[k]) ** 2
        if (rawDist < bestPlaceholder) {
          bestPlaceholder = rawDist
          bestWindow = { school, espnId: stats.espnId, yearStart: start, yearEnd: end, stats }
        }
      }
      if (bestWindow) windows.push(bestWindow)
    }

    // Min-max normalize across all windows
    const mins: Record<string, number> = {}
    const maxs: Record<string, number> = {}
    for (const k of statKeys) { mins[k] = Infinity; maxs[k] = -Infinity }
    for (const w of windows) {
      for (const k of statKeys) {
        const v = w.stats[k]
        if (v < mins[k]) mins[k] = v
        if (v > maxs[k]) maxs[k] = v
      }
    }

    // Compute normalized euclidean distance from query
    const queryNorm: Record<string, number> = {}
    for (const k of statKeys) {
      const range = maxs[k] - mins[k]
      queryNorm[k] = range > 0 ? (queryStats[k] - mins[k]) / range : 0
    }

    const results: SimilarResult[] = []
    for (const w of windows) {
      if (w.school === querySchool) continue
      let dist = 0
      for (const k of statKeys) {
        const range = maxs[k] - mins[k]
        const norm = range > 0 ? (w.stats[k] - mins[k]) / range : 0
        dist += (norm - queryNorm[k]) ** 2
      }
      dist = Math.sqrt(dist)
      results.push({ school: w.school, espnId: w.espnId, yearStart: w.yearStart, yearEnd: w.yearEnd, distance: dist, stats: w.stats })
    }

    results.sort((a, b) => a.distance - b.distance)
    return results.slice(0, 15)
  }, [seasons])

  return { schools, seasons, loading, getFilteredSchools, getFilteredCoaches, findSimilar }
}
