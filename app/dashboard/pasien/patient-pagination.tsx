'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const [isPending, startTransition] = useTransition()

  const currentPerPage = searchParams.get('perPage') || perPage.toString()
  const perPageNumber = Number(currentPerPage) || perPage || 10
  const totalPages = Math.max(1, Math.ceil(total / perPageNumber))

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  const handlePerPageChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('perPage', value)
      params.set('page', '1')
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  if (total === 0) {
    return null
  }

  const startRow = (page - 1) * perPageNumber + 1
  const endRow = Math.min(page * perPageNumber, total)

  const pages: number[] = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else if (page <= 3) {
    for (let i = 1; i <= 5; i++) pages.push(i)
  } else if (page >= totalPages - 2) {
    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
  } else {
    for (let i = page - 2; i <= page + 2; i++) {
      pages.push(i)
    }
  }

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t">
      <p className="text-sm text-slate-600">
        Menampilkan {startRow}-{endRow} dari {total.toLocaleString('id-ID')} pasien
      </p>
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || isPending}
            onClick={() => handlePageChange(1)}
            className="h-8 px-3"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || isPending}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>
          {pages.map((p) => (
            <Button
              key={p}
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handlePageChange(p)}
              className={p === page ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPending}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Per halaman</span>
          <Select
            value={currentPerPage}
            onValueChange={handlePerPageChange}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

