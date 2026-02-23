import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, MapPin, Users, TrendingUp } from 'lucide-react'
import { getPatientById } from '@/lib/actions/patients'
import { getTransactionsByPatient } from '@/lib/actions/transactions'
import { formatDate, formatCurrency, formatDateTime } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PasienDetailClient } from '../pasien-detail-client'
import { Suspense } from 'react'

// Komponen terpisah untuk patient info - bisa di-stream
async function PatientInfo({ patientId }: { patientId: string }) {
  const patient = await getPatientById(patientId)
  
  if (!patient) {
    notFound()
  }
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Informasi Pasien</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">No. RM</p>
            <p className="text-lg font-semibold text-slate-800">{patient.erm_no}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Nama Lengkap</p>
            <p className="text-lg font-semibold text-slate-800">{patient.full_name || '-'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Klinik</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <p className="text-lg font-semibold text-slate-800">{patient.clinic_name || '-'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">First Visit</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <p className="text-lg font-semibold text-slate-800">{formatDate(patient.first_visit_at)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Last Visit</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <p className="text-lg font-semibold text-slate-800">{formatDate(patient.last_visit_at)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Visit Count</p>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="inline-flex items-center justify-center w-10 h-10 bg-teal-100 text-teal-700 rounded-full text-lg font-bold">
                {patient.visit_count || 0}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Status</p>
            <Badge
              className={
                patient.status === 'Loyal'
                  ? 'bg-green-100 text-green-700 text-base px-3 py-1'
                  : patient.status === 'Active'
                    ? 'bg-blue-100 text-blue-700 text-base px-3 py-1'
                    : patient.status === 'New'
                      ? 'bg-purple-100 text-purple-700 text-base px-3 py-1'
                      : 'bg-amber-100 text-amber-700 text-base px-3 py-1'
              }
            >
              {patient.status}
            </Badge>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">ID Donatur Zains</p>
            <p className="text-lg font-semibold text-teal-600">{patient.id_donatur_zains || '-'}</p>
          </div>
          {patient.clinic_location && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Lokasi Klinik</p>
              <p className="text-lg font-semibold text-slate-800">{patient.clinic_location}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Komponen terpisah untuk transactions - bisa di-stream
async function TransactionsList({ patientId, pageNum, limitNum }: { patientId: number; pageNum: number; limitNum: number }) {
  const { transactions, total } = await getTransactionsByPatient(
    patientId,
    undefined,
    pageNum,
    limitNum
  )
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Transaksi</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Total {total.toLocaleString('id-ID')} transaksi ditemukan
        </p>
      </CardHeader>
      <CardContent>
        <PasienDetailClient 
          transactions={transactions}
          total={total}
          page={pageNum}
          limit={limitNum}
          patientId={patientId}
        />
      </CardContent>
    </Card>
  )
}

export default async function PasienDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; limit?: string }>
}) {
  const { id } = await params
  const { page = '1', limit = '10' } = await searchParams
  const pageNum = parseInt(page || '1')
  const limitNum = parseInt(limit || '10')
  
  // Fetch patient first untuk validasi
  const patient = await getPatientById(id)
  
  if (!patient) {
    notFound()
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pasien">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Detail Pasien</h2>
            <p className="text-slate-500 text-sm">Informasi lengkap pasien dan riwayat transaksi</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Patient Info Card - Streamed separately */}
        <Suspense fallback={null}>
          <PatientInfo patientId={id} />
        </Suspense>

        {/* Transactions List - Streamed separately */}
        <Suspense fallback={null}>
          <TransactionsList patientId={patient.id} pageNum={pageNum} limitNum={limitNum} />
        </Suspense>
      </div>
    </div>
  )
}
