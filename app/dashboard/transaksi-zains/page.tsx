import { getTransactionsToZainsList, getTransactionsToZainsStats } from '@/lib/actions/transactions'
import { getAllClinics } from '@/lib/actions/config'
import { TransaksiZainsClient } from './transaksi-zains-client'
import { Suspense } from 'react'
import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function TransaksiZainsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    perPage?: string
    clinic?: string
    dateFrom?: string
    dateTo?: string
    zainsSync?: string
    method?: string
  }>
}) {
  const [params, session] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
  ])

  const role = (session?.user as any)?.role || 'super_admin'
  const sessionClinicId = (session?.user as any)?.clinic_id as number | null | undefined

  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const getFirstDateOfMonth = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }

  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const perPage = parseInt(params.perPage || '10') || 10
  const requestedClinicId = params.clinic ? parseInt(params.clinic) : undefined
  const dateFrom = params.dateFrom || getFirstDateOfMonth()
  const dateTo = params.dateTo || getTodayDate()
  const zainsSync =
    params.zainsSync === 'synced' || params.zainsSync === 'pending'
      ? params.zainsSync
      : 'all'
  const zainsSynced = zainsSync as 'all' | 'synced' | 'pending'
  const method = params.method || 'all'

  const isClinicManager = role === 'clinic_manager'
  const clinicId = isClinicManager ? sessionClinicId ?? undefined : requestedClinicId

  const [listData, stats, clinics] = await Promise.all([
    getTransactionsToZainsList(search, clinicId, dateFrom, dateTo, page, perPage, zainsSynced, method),
    getTransactionsToZainsStats(search, clinicId, dateFrom, dateTo, zainsSynced, method),
    getAllClinics(),
  ])

  const { rows, total } = listData

  return (
    <Suspense fallback={<DataTablePageSkeleton showStatCards tableRows={10} />}>
      <div>
        <div className="p-6">
          <TransaksiZainsClient
            rows={rows}
            stats={stats}
            search={search}
            page={page}
            total={total}
            perPage={perPage}
            clinics={clinics}
            role={role}
            clinicId={clinicId}
          />
        </div>
      </div>
    </Suspense>
  )
}
