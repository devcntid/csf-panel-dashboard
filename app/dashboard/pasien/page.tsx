import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, TrendingUp, AlertTriangle } from 'lucide-react'
import { getPatients, getPatientStats } from '@/lib/actions/patients'
import { getAllClinics } from '@/lib/actions/config'
import { formatDate } from '@/lib/db'
import { PasienClient } from './pasien-client'
import { Suspense } from 'react'

// Komponen terpisah untuk stats - bisa di-stream
async function PatientStats() {
  const stats = await getPatientStats()
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Total Pasien Unik</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalPatients.toLocaleString('id-ID')}</p>
              <p className="text-green-500 text-xs mt-1">Retention: {stats.retentionRate}%</p>
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
              <p className="text-slate-500 text-sm font-medium">Retention Rate</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.retentionRate}%</p>
              <p className="text-green-500 text-xs mt-1">Loyal: {stats.loyalCount.toLocaleString('id-ID')}</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Churn Risk</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.churnRiskPercentage}%</p>
              <p className="text-amber-500 text-xs mt-1">{stats.churnRisk.toLocaleString('id-ID')} pasien</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium">Avg. Visit Count</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgVisitCount}</p>
              <p className="text-slate-500 text-xs mt-1">per pasien</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Komponen terpisah untuk patient list - bisa di-stream
async function PatientList({ search, page, clinicId }: { search: string; page: number; clinicId?: number }) {
  const { patients, total } = await getPatients(search, page, 10, clinicId)
  
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
                const rowNumber = (page - 1) * 10 + index + 1
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
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-teal-600"
                      asChild
                    >
                      <a href={`/dashboard/pasien/${patient.id}`}>
                        Detail
                      </a>
                    </Button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-slate-600">
            Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} of {total.toLocaleString('id-ID')} patients
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1}>
              Previous
            </Button>
            {Array.from({ length: Math.min(5, Math.ceil(total / 10)) }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className={p === page ? 'bg-teal-600 text-white' : ''}
              >
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page * 10 >= total}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Komponen terpisah untuk retention analysis
async function RetentionAnalysis() {
  const stats = await getPatientStats()
  const { patients } = await getPatients('', 1, 10)
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Segmentasi Pasien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-slate-700">Loyal (10+ visits)</span>
              </div>
              <span className="font-bold text-slate-800">
                {stats.loyalCount.toLocaleString('id-ID')} ({stats.totalPatients > 0 ? ((stats.loyalCount / stats.totalPatients) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-slate-700">Active (3-9 visits)</span>
              </div>
              <span className="font-bold text-slate-800">
                {stats.activeCount.toLocaleString('id-ID')} ({stats.totalPatients > 0 ? ((stats.activeCount / stats.totalPatients) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-slate-700">At Risk (&lt;3 visits)</span>
              </div>
              <span className="font-bold text-slate-800">
                {stats.atRiskCount.toLocaleString('id-ID')} ({stats.totalPatients > 0 ? ((stats.atRiskCount / stats.totalPatients) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                <span className="text-slate-700">New (1 visit)</span>
              </div>
              <span className="font-bold text-slate-800">
                {stats.newCount.toLocaleString('id-ID')} ({stats.totalPatients > 0 ? ((stats.newCount / stats.totalPatients) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Loyal Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {patients
              .sort((a: any, b: any) => (b.visit_count || 0) - (a.visit_count || 0))
              .slice(0, 5)
              .map((patient: any, index: number) => (
                <div key={patient.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{patient.full_name || '-'}</p>
                      <p className="text-xs text-slate-500">{patient.erm_no}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-teal-600">
                    {patient.visit_count || 0} visits
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PasienPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; clinic?: string }>
}) {
  const params = await searchParams
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const clinicId = params.clinic ? parseInt(params.clinic) : undefined

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
          <PatientStats />
        </Suspense>

        {/* Search */}
        <PasienClient clinics={clinics} />

        {/* Patient Table - Streamed separately */}
        <Suspense fallback={null}>
          <PatientList search={search} page={page} clinicId={clinicId} />
        </Suspense>

        {/* Retention Analysis - Streamed separately */}
        <Suspense fallback={null}>
          <RetentionAnalysis />
        </Suspense>
      </div>
    </div>
  )
}
