import { notFound } from 'next/navigation'
import { getClinicDashboardData } from '@/lib/actions/clinics'
import { ClinicDashboardView } from './clinic-dashboard-view'

function getYearToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const year = now.getFullYear()
  const dateFrom = `${year}-01-01`
  const dateTo = now.toISOString().split('T')[0]
  return { dateFrom, dateTo }
}

export default async function ClinicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}) {
  const { id } = await params
  const { dateFrom: qFrom, dateTo: qTo } = await searchParams
  const { dateFrom: ytdFrom, dateTo: ytdTo } = getYearToDateRange()
  const dateFrom = qFrom && qTo ? qFrom : ytdFrom
  const dateTo = qFrom && qTo ? qTo : ytdTo

  const clinicId = parseInt(id, 10)
  if (Number.isNaN(clinicId) || clinicId < 1) {
    notFound()
  }

  const data = await getClinicDashboardData(clinicId, { dateFrom, dateTo })
  if (!data.clinic) {
    notFound()
  }

  return (
    <ClinicDashboardView
      data={data}
      clinicId={clinicId}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  )
}
