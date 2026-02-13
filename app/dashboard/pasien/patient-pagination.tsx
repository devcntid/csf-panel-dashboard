'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/ui/pagination'

export function PatientPagination({
  page,
  total,
  perPage,
}: {
  page: number
  total: number
  perPage: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const limit = Number(searchParams.get('perPage') || perPage) || 10

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  const handleLimitChange = (newLimit: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('perPage', String(newLimit))
      params.set('page', '1')
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  return (
    <Pagination
      page={page}
      limit={limit}
      total={total}
      onPageChange={handlePageChange}
      onLimitChange={handleLimitChange}
    />
  )
}

