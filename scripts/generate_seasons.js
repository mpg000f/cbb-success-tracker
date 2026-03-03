// Generates per-season data from coaches.json
// Run: node scripts/generate_seasons.js

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const coaches = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', 'coaches.json'), 'utf-8'))

// Known championship years (school -> [years])
const titleYears = {
  'Duke-Mike Krzyzewski': [1991, 1992, 2001, 2010, 2015],
  'Duke-Jon Scheyer': [2025],
  'North Carolina-Dean Smith': [1993],
  'North Carolina-Roy Williams': [2005, 2009, 2017],
  'North Carolina-Hubert Davis': [2022],
  'Kansas-Bill Self': [2008, 2022],
  'Kentucky-Rick Pitino': [1996],
  'Kentucky-Tubby Smith': [1998],
  'Kentucky-John Calipari': [2012],
  'Connecticut-Jim Calhoun': [1999, 2004, 2011],
  'Connecticut-Dan Hurley': [2023, 2024],
  'Villanova-Jay Wright': [2016, 2018],
  'Michigan State-Tom Izzo': [2000],
  'Louisville-Rick Pitino': [2013],
  'Syracuse-Jim Boeheim': [2003],
  'Florida-Billy Donovan': [2006, 2007],
  'Arizona-Lute Olson': [1997],
  'Indiana-Bob Knight': [1987],
  'UNLV-Jerry Tarkanian': [1990],
  'Arkansas-Nolan Richardson': [1994],
  'Maryland-Maryland': [],
  'Virginia-Tony Bennett': [2019],
  'Baylor-Scott Drew': [2021],
  'UCLA-': [],
  'Houston-Kelvin Sampson': [2025],
}

// Known Final Four years (approximate for distributing)
const finalFourYears = {
  'Duke-Mike Krzyzewski': [1986, 1988, 1989, 1990, 1991, 1992, 1994, 1999, 2001, 2004, 2010, 2015],
  'Duke-Jon Scheyer': [2025],
  'North Carolina-Dean Smith': [1991, 1993, 1995, 1997],
  'North Carolina-Roy Williams': [2005, 2008, 2009, 2016, 2017],
  'North Carolina-Hubert Davis': [2022],
  'Kansas-Roy Williams': [1991, 1993, 2002, 2003],
  'Kansas-Bill Self': [2003, 2008, 2012, 2022],
  'Kentucky-Rick Pitino': [1993, 1996, 1997],
  'Kentucky-Tubby Smith': [1998],
  'Kentucky-John Calipari': [2011, 2012, 2014, 2015],
  'Connecticut-Jim Calhoun': [1999, 2004, 2009, 2011],
  'Connecticut-Dan Hurley': [2023, 2024],
  'Villanova-Jay Wright': [2009, 2016, 2018, 2022],
  'Michigan State-Tom Izzo': [1999, 2000, 2001, 2005, 2009, 2010, 2015, 2019],
  'Louisville-Rick Pitino': [2005, 2012, 2013],
  'Syracuse-Jim Boeheim': [1996, 2003, 2013, 2016],
  'Florida-Billy Donovan': [2000, 2006, 2007, 2014],
  'Arizona-Lute Olson': [1988, 1994, 1997, 2001],
  'Indiana-Bob Knight': [1987, 1992],
  'UNLV-Jerry Tarkanian': [1987, 1990, 1991],
  'Arkansas-Nolan Richardson': [1990, 1994, 1995],
  'Virginia-Tony Bennett': [2019],
  'Baylor-Scott Drew': [2021],
  'Gonzaga-Mark Few': [2017, 2021, 2024],
  'Oklahoma-Lon Kruger': [2016],
  'Michigan-John Beilein': [2013, 2018],
  'Houston-Kelvin Sampson': [2021, 2024],
  'Marquette-': [],
  'Wisconsin-Bo Ryan': [2014, 2015],
  'Purdue-Matt Painter': [2024],
  'Ohio State-Thad Matta': [2007, 2012],
  'Memphis-John Calipari': [2008],
  'Auburn-Bruce Pearl': [2019, 2025],
  'NC State-': [],
}

function getKey(c) {
  return `${c.school}-${c.coach}`
}

const seasons = []

for (const c of coaches) {
  const key = getKey(c)
  const numYears = c.endYear - c.startYear + 1
  if (numYears <= 0) continue

  const baseWins = Math.floor(c.wins / numYears)
  const baseLosses = Math.floor(c.losses / numYears)
  let remainWins = c.wins - baseWins * numYears
  let remainLosses = c.losses - baseLosses * numYears

  // Get known achievement years
  const knownTitles = new Set(titleYears[key] || [])
  const knownFF = new Set(finalFourYears[key] || [])

  // Distribute tournament appearances across years
  const tourneyYearsList = []
  // Title years and FF years are always tourney years
  for (let y = c.startYear; y <= c.endYear; y++) {
    if (knownTitles.has(y) || knownFF.has(y)) tourneyYearsList.push(y)
  }
  // Fill remaining tourney apps
  let remainTourney = c.tournamentApps - tourneyYearsList.length
  for (let y = c.startYear; y <= c.endYear && remainTourney > 0; y++) {
    if (!tourneyYearsList.includes(y)) {
      tourneyYearsList.push(y)
      remainTourney--
    }
  }
  const tourneyYears = new Set(tourneyYearsList)

  // Distribute S16, E8 among tourney years (non-FF, non-title years first)
  const tourneyOnly = [...tourneyYears].filter(y => !knownFF.has(y) && !knownTitles.has(y)).sort()
  let remainS16 = c.sweet16 - knownFF.size // FF implies at least S16
  // title years that aren't in FF set
  for (const y of knownTitles) {
    if (!knownFF.has(y) && tourneyYears.has(y)) remainS16--
  }
  const s16Years = new Set([...knownFF, ...knownTitles].filter(y => y >= c.startYear && y <= c.endYear))
  for (const y of tourneyOnly) {
    if (remainS16 <= 0) break
    s16Years.add(y)
    remainS16--
  }

  let remainE8 = c.elite8 - [...knownFF].filter(y => y >= c.startYear && y <= c.endYear).length
  const e8Years = new Set([...knownFF].filter(y => y >= c.startYear && y <= c.endYear))
  const s16Only = [...s16Years].filter(y => !e8Years.has(y)).sort()
  for (const y of s16Only) {
    if (remainE8 <= 0) break
    e8Years.add(y)
    remainE8--
  }

  // Distribute conf titles
  let remainConfReg = c.confRegularSeason
  let remainConfT = c.confTournament
  const confRegYears = new Set()
  const confTYears = new Set()
  // Spread them out somewhat evenly
  const step = numYears > 0 ? Math.max(1, Math.floor(numYears / (c.confRegularSeason || 1))) : 1
  let idx = 0
  for (let y = c.startYear; y <= c.endYear && remainConfReg > 0; y += Math.max(1, step - 1)) {
    confRegYears.add(y)
    remainConfReg--
    idx++
  }
  const stepT = numYears > 0 ? Math.max(1, Math.floor(numYears / (c.confTournament || 1))) : 1
  for (let y = c.startYear + 1; y <= c.endYear && remainConfT > 0; y += Math.max(1, stepT - 1)) {
    confTYears.add(y)
    remainConfT--
  }

  for (let year = c.startYear; year <= c.endYear; year++) {
    // Add some variance to wins/losses
    let w = baseWins + (remainWins > 0 ? 1 : 0)
    let l = baseLosses + (remainLosses > 0 ? 1 : 0)
    if (remainWins > 0) remainWins--
    if (remainLosses > 0) remainLosses--

    // Boost wins in title/FF years
    if (knownTitles.has(year)) {
      w = Math.min(w + 5, 40)
      l = Math.max(l - 3, 1)
    } else if (knownFF.has(year)) {
      w = Math.min(w + 3, 38)
      l = Math.max(l - 2, 2)
    }

    const isTourney = tourneyYears.has(year)
    const isS16 = s16Years.has(year)
    const isE8 = e8Years.has(year)
    const isFF = knownFF.has(year) && year >= c.startYear && year <= c.endYear
    const isCG = isFF && (knownTitles.has(year) ||
      // championship game losers: pick some FF years
      (c.champGame > c.titles && [...knownFF].indexOf(year) < c.champGame))
    const isTitle = knownTitles.has(year)

    seasons.push({
      coach: c.coach,
      school: c.school,
      espnId: c.espnId,
      year,
      wins: w,
      losses: l,
      tournamentApp: isTourney ? 1 : 0,
      sweet16: isS16 ? 1 : 0,
      elite8: isE8 ? 1 : 0,
      finalFour: isFF ? 1 : 0,
      champGame: isCG ? 1 : 0,
      title: isTitle ? 1 : 0,
      confRegSeason: confRegYears.has(year) ? 1 : 0,
      confTourney: confTYears.has(year) ? 1 : 0,
    })
  }
}

seasons.sort((a, b) => a.year - b.year || a.school.localeCompare(b.school))

writeFileSync(
  join(__dirname, '..', 'public', 'data', 'seasons.json'),
  JSON.stringify(seasons, null, 2)
)

console.log(`Generated ${seasons.length} season records`)
