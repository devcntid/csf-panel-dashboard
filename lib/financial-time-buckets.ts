export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type DateBucket = {
  key: string
  label: string
  tgl_awal: string // YYYY-MM-DD
  tgl_akhir: string // YYYY-MM-DD
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = pad2(d.getUTCMonth() + 1)
  const day = pad2(d.getUTCDate())
  return `${y}-${m}-${day}`
}

function utcDate(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d))
}

function startOfUtcDay(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + days)
  return startOfUtcDay(x)
}

/** ISO week start (Monday) in UTC. */
function startOfIsoWeekUtc(d: Date): Date {
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7
  return addDaysUtc(startOfUtcDay(d), -diffToMon)
}

export function buildBuckets(params: {
  period: TimePeriod
  year: number
  now?: Date
}): DateBucket[] {
  const now = params.now ? startOfUtcDay(params.now) : startOfUtcDay(new Date())
  const year = params.year

  if (params.period === 'daily') {
    // last 14 days, ending today
    const buckets: DateBucket[] = []
    for (let i = 13; i >= 0; i--) {
      const d = addDaysUtc(now, -i)
      buckets.push({
        key: fmtDate(d),
        label: `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`,
        tgl_awal: fmtDate(d),
        tgl_akhir: fmtDate(d),
      })
    }
    return buckets
  }

  if (params.period === 'weekly') {
    // last 8 ISO weeks, ending current week
    const buckets: DateBucket[] = []
    const week0 = startOfIsoWeekUtc(now)
    for (let i = 7; i >= 0; i--) {
      const start = addDaysUtc(week0, -7 * i)
      const end = addDaysUtc(start, 6)
      buckets.push({
        key: fmtDate(start),
        label: `W${8 - i}`,
        tgl_awal: fmtDate(start),
        tgl_akhir: fmtDate(end),
      })
    }
    return buckets
  }

  if (params.period === 'monthly') {
    const buckets: DateBucket[] = []
    for (let m0 = 0; m0 < 12; m0++) {
      const start = utcDate(year, m0, 1)
      const end = utcDate(year, m0 + 1, 0)
      buckets.push({
        key: `${year}-${pad2(m0 + 1)}`,
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m0],
        tgl_awal: fmtDate(start),
        tgl_akhir: fmtDate(end),
      })
    }
    return buckets
  }

  if (params.period === 'yearly') {
    // tidak dipakai untuk tracker (tracker yearly pakai group_by=yearly dari Zains langsung)
    return []
  }

  // quarterly
  const buckets: DateBucket[] = []
  for (let q = 1; q <= 4; q++) {
    const m0 = (q - 1) * 3
    const start = utcDate(year, m0, 1)
    const end = utcDate(year, m0 + 3, 0)
    buckets.push({
      key: `Q${q}`,
      label: `Q${q}`,
      tgl_awal: fmtDate(start),
      tgl_akhir: fmtDate(end),
    })
  }
  return buckets
}

