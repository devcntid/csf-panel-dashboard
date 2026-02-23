import { getTransactions, getTransactionStats } from '@/lib/actions/transactions'
import { getAllClinics, getMasterPolies, getMasterInsuranceTypes } from '@/lib/actions/config'
import { TransaksiClient } from './transaksi-client'
import { Suspense } from 'react'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; perPage?: string; clinic?: string; poly?: string; insurance?: string; dateFrom?: string; dateTo?: string; zainsSync?: string }>
}) {
  const params = await searchParams
  
  // Default tanggal awal ke tanggal 1 bulan ini, tanggal akhir ke hari ini
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
  const clinicId = params.clinic ? parseInt(params.clinic) : undefined
  const polyId = params.poly ? parseInt(params.poly) : undefined
  const insuranceTypeId = params.insurance ? parseInt(params.insurance) : undefined
  const dateFrom = params.dateFrom || getFirstDateOfMonth()
  const dateTo = params.dateTo || getTodayDate()
  const zainsSync = (params.zainsSync === 'synced' || params.zainsSync === 'pending') ? params.zainsSync : 'all'
  const zainsSynced: 'all' | 'synced' | 'pending' = zainsSync as 'all' | 'synced' | 'pending'
  
  const [transactionsData, stats, clinics, polies, insuranceTypes] = await Promise.all([
    getTransactions(search, clinicId, dateFrom, dateTo, page, perPage, polyId, insuranceTypeId, zainsSynced),
    getTransactionStats(search, clinicId, dateFrom, dateTo, polyId, insuranceTypeId, zainsSynced),
    getAllClinics(),
    getMasterPolies(),
    getMasterInsuranceTypes(),
  ])
  
  const { transactions, total } = transactionsData
  
  return (
    <Suspense fallback={null}>
      <div>
        {/* Content */}
        <div className="p-6">
          <TransaksiClient 
            transactions={transactions} 
            stats={stats}
            search={search}
            page={page}
            total={total}
            perPage={perPage}
            clinics={clinics}
            polies={polies}
            insuranceTypes={insuranceTypes}
          />
        </div>
      </div>
    </Suspense>
  )
}
