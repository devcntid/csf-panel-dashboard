import { getTransactions, getTransactionStats } from '@/lib/actions/transactions'
import { getAllClinics, getMasterPolies, getMasterInsuranceTypes } from '@/lib/actions/config'
import { TransaksiClient } from './transaksi-client'
import { Suspense } from 'react'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; clinic?: string; poly?: string; insurance?: string; dateFrom?: string; dateTo?: string }>
}) {
  const params = await searchParams
  
  // Default tanggal ke hari ini jika belum ada
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const clinicId = params.clinic ? parseInt(params.clinic) : undefined
  const polyId = params.poly ? parseInt(params.poly) : undefined
  const insuranceTypeId = params.insurance ? parseInt(params.insurance) : undefined
  const dateFrom = params.dateFrom || getTodayDate()
  const dateTo = params.dateTo || getTodayDate()
  
  const [transactionsData, stats, clinics, polies, insuranceTypes] = await Promise.all([
    getTransactions(search, clinicId, dateFrom, dateTo, page, 10, polyId, insuranceTypeId),
    getTransactionStats(search, clinicId, dateFrom, dateTo, polyId, insuranceTypeId),
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
            clinics={clinics}
            polies={polies}
            insuranceTypes={insuranceTypes}
          />
        </div>
      </div>
    </Suspense>
  )
}
