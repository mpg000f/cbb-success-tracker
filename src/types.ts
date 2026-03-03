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

export type ViewMode = 'schools' | 'coaches' | 'compare'

export interface Filters {
  search: string
  yearStart: number
  yearEnd: number
}
