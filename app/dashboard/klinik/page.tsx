import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Settings, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { getClinics } from '@/lib/actions/clinics'
import { formatCurrency, getRelativeTime } from '@/lib/db'
import { KlinikClient } from './klinik-client'

export default async function KlinikPage() {
  const clinics = await getClinics()

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Manajemen Klinik</h2>
            <p className="text-slate-500 text-sm">Kelola credential dan target pendapatan klinik</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Clinic Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {clinics.map((clinic: any) => {
            const revenueToday = Number(clinic.revenue_today || 0)
            const revenueTarget = Number(clinic.revenue_target || 0)
            const percentage = revenueTarget > 0 ? (revenueToday / revenueTarget) * 100 : 0
            const status = clinic.last_scraped_at 
              ? (new Date().getTime() - new Date(clinic.last_scraped_at).getTime() < 300000 ? 'Stable' : 'Slow')
              : 'Unknown'
            
            return (
              <Card key={clinic.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{clinic.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            className={
                              status === 'Stable'
                                ? 'bg-green-100 text-green-700'
                                : status === 'Slow'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                            }
                          >
                            <div
                              className={`w-2 h-2 rounded-full mr-1 ${
                                status === 'Stable'
                                  ? 'bg-green-500 animate-pulse'
                                  : status === 'Slow'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                            />
                            {status}
                          </Badge>
                          {clinic.last_scraped_at && (
                            <span className="text-xs text-slate-500">
                              Last sync: {getRelativeTime(clinic.last_scraped_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/dashboard/klinik/${clinic.id}`}>
                      <Button size="sm" variant="outline" className="text-teal-600 border-teal-600 bg-transparent">
                        <Settings className="w-4 h-4 mr-2" />
                        Detail
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Target & Realization */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-600">Pendapatan Hari Ini</span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(revenueToday)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-600">Total Pasien</span>
                      <span className="font-bold text-teal-600">
                        {Number(clinic.total_patients || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {revenueTarget > 0 && (
                      <>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                          <div
                            className="bg-teal-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(percentage, 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-right text-xs text-slate-500 mt-1">
                          {percentage.toFixed(1)}% tercapai
                        </p>
                      </>
                    )}
                  </div>

                  {/* Credentials Config */}
                  <KlinikClient clinic={clinic} />

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 bg-transparent" size="sm">
                      Test Connection
                    </Button>
                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700" size="sm">
                      Update Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Add New Clinic */}
        <Card className="mt-6 border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-2">Tambah Klinik Baru</h3>
            <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
              Tambahkan klinik cabang baru untuk mulai scraping dan monitoring data
            </p>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Building2 className="w-4 h-4 mr-2" />
              Tambah Klinik
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
