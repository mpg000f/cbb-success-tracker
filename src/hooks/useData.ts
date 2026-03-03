import { useState, useEffect } from 'react'
import type { SchoolRecord, CoachRecord } from '../types'

const BASE = import.meta.env.BASE_URL

export function useData() {
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [coaches, setCoaches] = useState<CoachRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/schools.json`).then(r => r.json()),
      fetch(`${BASE}data/coaches.json`).then(r => r.json()),
    ]).then(([s, c]) => {
      setSchools(s)
      setCoaches(c)
      setLoading(false)
    })
  }, [])

  return { schools, coaches, loading }
}
