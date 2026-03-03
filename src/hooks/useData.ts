import { useState, useEffect, useCallback } from 'react'
import type { SchoolRecord, CoachRecord, SeasonRecord } from '../types'

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

  const getFilteredSchools = useCallback((yearStart: number, yearEnd: number, search: string): SchoolRecord[] => {
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

    return [...bySchool.values()].filter(s => s.school.toLowerCase().includes(q))
  }, [seasons, schools])

  const getFilteredCoaches = useCallback((yearStart: number, yearEnd: number, search: string): CoachRecord[] => {
    const q = search.toLowerCase()
    const filtered = seasons.filter(s => s.year >= yearStart && s.year <= yearEnd)

    const byCoachSchool = new Map<string, CoachRecord>()
    for (const s of filtered) {
      const key = `${s.coach}|||${s.school}`
      const existing = byCoachSchool.get(key)
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
        byCoachSchool.set(key, {
          coach: s.coach,
          school: s.school,
          espnId: s.espnId,
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
    for (const c of byCoachSchool.values()) {
      const total = c.wins + c.losses
      c.winPct = total > 0 ? Math.round((c.wins / total) * 1000) / 1000 : 0
      c.years = `${c.startYear}-${c.endYear}`
    }

    return [...byCoachSchool.values()].filter(c =>
      c.coach.toLowerCase().includes(q) || c.school.toLowerCase().includes(q)
    )
  }, [seasons])

  return { schools, seasons, loading, getFilteredSchools, getFilteredCoaches }
}
