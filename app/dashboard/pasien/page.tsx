import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { getPatients, getPatientStats } from '@/lib/actions/patients'
import { getAllClinics } from '@/lib/actions/config'
import { formatDate } from '@/lib/db'
import { PasienClient } from './pasien-client'
import { PatientPagination } from './patient-pagination'
import { PasienRowActions } from './pasien-row-actions'
import { Suspense } from 'react'

// Komponen terpisah untuk stats - bisa di-stream
async function PatientStats({ search, clinicId }: { search: string; clinicId?: number }) {
  const stats = await getPatientStats(search, clinicId)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Total Pasien</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalPatients.toLocaleString('id-ID')}</p>
              <p className="text-slate-500 text-xs mt-1">Semua pasien sesuai filter</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Tanpa Zains</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {stats.withoutZains.toLocaleString('id-ID')}
              </p>
              <p className="text-slate-500 text-xs mt-1">Pasien tanpa transaksi ke Zains</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Antrian Zains</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {stats.zainsQueue.toLocaleString('id-ID')}
              </p>
              <p className="text-slate-500 text-xs mt-1">Punya transaksi Zains, belum tersinkron</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Komponen terpisah untuk patient list - bisa di-stream
async function PatientList({ search, page, clinicId, perPage }: { search: string; page: number; clinicId?: number; perPage: number }) {
  const { patients, total } = await getPatients(search, page, perPage, clinicId)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Daftar Pasien</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              All
            </Button>
            <Button variant="outline" size="sm">
              Loyal
            </Button>
            <Button variant="outline" size="sm">
              Active
            </Button>
            <Button variant="outline" size="sm">
              At Risk
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                  No. RM
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                  Nama Pasien
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                  Klinik
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                  First Visit
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                  Last Visit
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                  Visit Count
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient: any, index: number) => {
                const rowNumber = (page - 1) * perPage + index + 1
                return (
                  <tr
                    key={patient.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                    <td className="py-3 px-4 text-sm font-medium text-teal-600">
                      {patient.erm_no}
                    </td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-800">
                    {patient.full_name || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">{patient.clinic_name || '-'}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{formatDate(patient.first_visit_at)}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{formatDate(patient.last_visit_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-700 rounded-full text-sm font-bold">
                      {patient.visit_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      className={
                        patient.status === 'Loyal'
                          ? 'bg-green-100 text-green-700'
                          : patient.status === 'Active'
                            ? 'bg-blue-100 text-blue-700'
                            : patient.status === 'New'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {patient.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <PasienRowActions patientId={patient.id} patientName={patient.full_name} />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <PatientPagination page={page} total={total} perPage={perPage} />
      </CardContent>
    </Card>
  )
}

export default async function PasienPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; clinic?: string; perPage?: string }>
}) {
  const params = await searchParams
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const clinicId = params.clinic ? parseInt(params.clinic) : undefined
  const perPage = parseInt(params.perPage || '10') || 10

  // Fetch clinics untuk dropdown filter
  const clinics = await getAllClinics()

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Data Pasien</h2>
            <p className="text-slate-500 text-sm">Analisis Retensi & Loyalitas Pasien</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Stats Cards - Streamed separately */}
        <Suspense fallback={null}>
          <PatientStats search={search} clinicId={clinicId} />
        </Suspense>

        {/* Search */}
        <PasienClient clinics={clinics} />

        {/* Patient Table - Streamed separately */}
        <Suspense fallback={null}>
          <PatientList search={search} page={page} clinicId={clinicId} perPage={perPage} />
        </Suspense>
      </div>
    </div>
  )
}
