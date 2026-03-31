import { NextRequest, NextResponse } from 'next/server'
import { queryFinsTotals } from '@/lib/fins-totals'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const now = new Date()
    const currentYear = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()

    const json: any = await queryFinsTotals({
      type: 'receipt',
      group_by: 'yearly',
    })

    const rows: any[] = Array.isArray(json?.data) ? json.data : []
    const years = rows.map((r) => ({
      year: Number(r.year ?? 0),
      value: Number(r.sum ?? 0),
    }))

    const current = years.find((y) => y.year === currentYear) ?? null
    const previous = years.find((y) => y.year === currentYear - 1) ?? null

    let growth_pct: number | null = null
    if (current && previous && previous.value !== 0) {
      growth_pct = ((current.value - previous.value) / Math.abs(previous.value)) * 100
    }

    return NextResponse.json(
      {
        success: true,
        current_year: currentYear,
        years,
        current,
        previous,
        growth_pct,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error financial revenue-growth:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengambil growth revenue tahunan' },
      { status: 500 },
    )
  }
}

