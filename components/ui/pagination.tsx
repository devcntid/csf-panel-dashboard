'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export function Pagination({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  // Ensure total is a number, default to 0 if undefined
  const safeTotal = total ?? 0
  const totalPages = Math.ceil(safeTotal / limit)
  const start = safeTotal === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, safeTotal)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total pages <= maxVisible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (page > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const startPage = Math.max(2, page - 1)
      const endPage = Math.min(totalPages - 1, page + 1)

      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i)
        }
      }

      if (page < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-slate-50">
      {/* Info & Row Selector */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="text-sm text-slate-600">
          Menampilkan <span className="font-semibold">{start}</span> - <span className="font-semibold">{end}</span> dari{' '}
          <span className="font-semibold">{safeTotal.toLocaleString('id-ID')}</span> data
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Baris per halaman:</span>
          <Select
            value={limit.toString()}
            onValueChange={(v) => {
              const newLimit = parseInt(v, 10)
              onLimitChange(newLimit)
              // Jangan panggil onPageChange(1) di sini: parent (handleLimitChange) sudah set page=1 di URL.
              // Memanggil keduanya menyebabkan dua router.push berurutan; push kedua pakai searchParams
              // lama sehingga perPage yang baru tertimpa kembali ke nilai default.
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="h-8 px-3"
          title="Halaman pertama"
        >
          <ChevronsLeft className="w-4 h-4 mr-1" />
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-8 w-8 p-0"
          title="Halaman sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        {getPageNumbers().map((pageNum, idx) => {
          if (pageNum === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                ...
              </span>
            )
          }
          return (
            <Button
              key={pageNum}
              variant={page === pageNum ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum as number)}
              className={`h-8 w-8 p-0 ${page === pageNum ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}`}
            >
              {pageNum}
            </Button>
          )
        })}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="h-8 w-8 p-0"
          title="Halaman berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="h-8 px-3"
          title="Halaman terakhir"
        >
          Last
          <ChevronsRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
