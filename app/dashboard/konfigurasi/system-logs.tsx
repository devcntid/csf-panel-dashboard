'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { formatDateTime } from '@/lib/db'
import { getSystemLogsPaginated } from '@/lib/actions/pagination'
import { Filter, Search, RefreshCw } from 'lucide-react'


interface SystemLogsProps {
  clinics: any[]
  initialData?: { logs: any[]; total: number; page: number; limit: number }
}

export function SystemLogs({ clinics, initialData }: SystemLogsProps) {
  const [logs, setLogs] = useState<any[]>(initialData?.logs || [])
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [isPending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    clinic_id: '',
    status: '',
    process_type: '',
    start_date: '',
    end_date: '',
  })

  const loadLogs = () => {
    startTransition(async () => {
      const result = await getSystemLogsPaginated(
        filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
        filters.process_type || undefined,
        filters.status || undefined,
        filters.start_date || undefined,
        filters.end_date || undefined,
        filters.search || undefined,
        page,
        limit
      )
      setLogs(result.logs)
      setTotal(result.total)
    })
  }

  useEffect(() => {
    // Always fetch when page, limit, or filters change
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filters.clinic_id, filters.status, filters.process_type, filters.start_date, filters.end_date])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadLogs()
  }

  const handleResetFilters = () => {
    setFilters({
      search: '',
      clinic_id: '',
      status: '',
      process_type: '',
      start_date: '',
      end_date: '',
    })
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs text-slate-600 mb-1 block">Pencarian Cepat</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Cari berdasarkan pesan, status, atau process type..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="flex-1"
            />
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={isPending}>
              <Search className="w-4 h-4 mr-1" />
              Cari
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter Lanjutan
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetFilters}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </form>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Klinik</Label>
                <Select
                  value={filters.clinic_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, clinic_id: value === 'all' ? '' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Klinik" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Klinik</SelectItem>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id.toString()}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, status: value === 'all' ? '' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                    <SelectItem value="FAILED">FAILED</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Process Type</Label>
                <Input
                  placeholder="Contoh: scraping, sync, import"
                  value={filters.process_type}
                  onChange={(e) => {
                    setFilters({ ...filters, process_type: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Periode Tanggal</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => {
                      setFilters({ ...filters, start_date: e.target.value })
                      setPage(1)
                    }}
                  />
                  <Input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => {
                      setFilters({ ...filters, end_date: e.target.value })
                      setPage(1)
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Waktu
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Klinik
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Process Type
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Pesan
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !isPending ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Tidak ada system logs
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => {
                    const rowNumber = (page - 1) * limit + index + 1
                    return (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDateTime(log.created_at)}
                        </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {log.clinic_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">
                        {log.process_type}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={
                            log.status === 'SUCCESS'
                              ? 'inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'
                              : log.status === 'FAILED'
                                ? 'inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700'
                                : 'inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700'
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-xl">
                        <span className="line-clamp-2">{log.message || '-'}</span>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
