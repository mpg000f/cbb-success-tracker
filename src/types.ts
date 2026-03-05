export interface SchoolRecord {
  school: string
  espnId: number
  conference: string
  wins: number
  losses: number
  winPct: number
  tournamentApps: number
  sweet16: number
  elite8: number
  finalFour: number
  champGame: number
  titles: number
  confRegularSeason: number
  confTournament: number
}

export interface CoachRecord {
  coach: string
  school: string
  espnId: number
  schoolLogos: { school: string; espnId: number }[]
  years: string
  startYear: number
  endYear: number
  wins: number
  losses: number
  winPct: number
  tournamentApps: number
  sweet16: number
  elite8: number
  finalFour: number
  champGame: number
  titles: number
  confRegularSeason: number
  confTournament: number
}

export interface SeasonRecord {
  coach: string
  school: string
  espnId: number
  year: number
  wins: number
  losses: number
  tournamentApp: number
  sweet16: number
  elite8: number
  finalFour: number
  champGame: number
  title: number
  confRegSeason: number
  confTourney: number
}

export type ViewMode = 'schools' | 'coaches' | 'compare' | 'similar'

export type SimilarMode = 'schools' | 'coaches'

export type PowerRatings = Record<string, Record<string, number>>

export interface SimilarResult {
  school: string
  espnId: number
  yearStart: number
  yearEnd: number
  distance: number
  stats: SchoolRecord
  coach?: string
  schoolLogos?: { school: string; espnId: number }[]
  effMargin?: number
}

export interface Filters {
  search: string
  yearStart: number
  yearEnd: number
  conferences: string[]
}
