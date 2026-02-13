'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserPlus } from 'lucide-react'
import { KonfigurasiClient } from './konfigurasi-client'
import { CRUDKlinik } from './crud-klinik'
import { CRUDPoli } from './crud-poli'
import { CRUDTargetCategory } from './crud-target-category'
import { CRUDTarget } from './crud-target'
import { CRUDDailyTarget } from './crud-daily-target'
import { CRUDUser } from './crud-user'
import { SystemLogs } from './system-logs'
import { CRUDSource } from './crud-source'
import { CRUDInsuranceMapping } from './crud-insurance-mapping'
import { CRUDInsuranceType } from './crud-insurance-type'
import { CRUDPublicHoliday } from './crud-public-holiday'
import { ZainsSyncSetting } from './zains-sync-setting'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function KonfigurasiTabs({
  masterPolies,
  masterInsuranceTypes,
  users,
  clinics,
  sources,
  initialData,
}: {
  masterPolies: any[]
  masterInsuranceTypes: any[]
  users: any[]
  clinics: any[]
  sources: any[]
  initialData?: {
    mappings: { mappings: any[]; total: number; page: number; limit: number }
    insuranceMappings: { mappings: any[]; total: number; page: number; limit: number }
    insuranceTypes: { insuranceTypes: any[]; total: number; page: number; limit: number }
    clinics: { clinics: any[]; total: number; page: number; limit: number }
    polies: { polies: any[]; total: number; page: number; limit: number }
    categories: { categories: any[]; total: number; page: number; limit: number }
    users: { users: any[]; total: number; page: number; limit: number }
    targetConfigs: { configs: any[]; total: number; page: number; limit: number }
    dailyTargets: { targets: any[]; total: number; page: number; limit: number }
    systemLogs?: { logs: any[]; total: number; page: number; limit: number }
    publicHolidays?: { holidays: any[]; total: number; page: number; limit: number }
  }
}) {
  const [activeTab, setActiveTab] = useState('mapping')
  const [runningQueue, setRunningQueue] = useState(false)
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh()
  }

  const handleRunScrapQueue = async () => {
    setRunningQueue(true)
    try {
      const res = await fetch('/api/scrap/run-queue', { method: 'POST' })
      let data: any = {}
      try {
        data = await res.json()
      } catch {
        // ignore json error
      }

      if (!res.ok || !data?.success) {
        toast.error(data?.message || 'Gagal men-trigger scrap queue')
        return
      }

      toast.success('Scrap queue berhasil dijalankan di background')
    } catch (error: any) {
      toast.error(error?.message || 'Gagal men-trigger scrap queue')
    } finally {
      setRunningQueue(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-slate-200">
        {/* Scrollable tabs untuk mode mobile supaya tidak offside */}
        <div className="overflow-x-auto">
          <nav className="flex gap-4 min-w-max px-2 pb-1">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'mapping'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Mapping Poliklinik
          </button>
          <button
            onClick={() => setActiveTab('insurance-mapping')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'insurance-mapping'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Mapping Insurance
          </button>
          <button
            onClick={() => setActiveTab('insurance-type')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'insurance-type'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Master Insurance Type
          </button>
          <button
            onClick={() => setActiveTab('klinik')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'klinik'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Master Klinik
          </button>
          <button
            onClick={() => setActiveTab('poli')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'poli'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Master Poli
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'source'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Master Source
          </button>
          <button
            onClick={() => setActiveTab('kategori')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'kategori'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Kategori Target
          </button>
          <button
            onClick={() => setActiveTab('target')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'target'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Setting Tarif
          </button>
          <button
            onClick={() => setActiveTab('daily-target')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'daily-target'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Target Harian
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            User Access
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'holidays'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Hari Libur
          </button>
          <button
            onClick={() => setActiveTab('zains-sync')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'zains-sync'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sync Zains
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            System Logs
          </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'mapping' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mapping Poliklinik</CardTitle>
                  <CardDescription>
                    Standarisasi nama poliklinik dari eClinic ke Master Poli
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <KonfigurasiClient
                initialData={initialData?.mappings}
                masterPolies={masterPolies}
                clinics={clinics}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'insurance-mapping' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mapping Insurance Type</CardTitle>
                  <CardDescription>
                    Standarisasi nama insurance type dari eClinic ke Master Insurance Type
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CRUDInsuranceMapping
                initialData={initialData?.insuranceMappings}
                masterInsuranceTypes={masterInsuranceTypes}
                clinics={clinics}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'insurance-type' && (
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Master Insurance Type</CardTitle>
              <CardDescription>Kelola data master insurance type (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDInsuranceType onRefresh={handleRefresh} initialData={initialData?.insuranceTypes} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'klinik' && (
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Klinik</CardTitle>
              <CardDescription>Kelola data klinik (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDKlinik onRefresh={handleRefresh} initialData={initialData?.clinics} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'poli' && (
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Master Poli</CardTitle>
              <CardDescription>Kelola data master poli (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDPoli onRefresh={handleRefresh} initialData={initialData?.polies} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'source' && (
          <Card>
            <CardHeader>
              <CardTitle>Master Source</CardTitle>
              <CardDescription>Kelola sumber target harian (SE Klinik, SE Ambulance, dsb)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDSource onRefresh={handleRefresh} initialData={sources} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'kategori' && (
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Kategori Target</CardTitle>
              <CardDescription>Kelola data kategori target (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDTargetCategory onRefresh={handleRefresh} initialData={initialData?.categories} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'target' && (
          <Card>
            <CardHeader>
              <CardTitle>Setting Tarif</CardTitle>
              <CardDescription>Kelola konfigurasi tarif dasar per klinik per poli per tahun</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDTarget 
                onRefresh={handleRefresh} 
                initialData={initialData?.targetConfigs}
                initialPolies={masterPolies}
                initialClinics={clinics}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'daily-target' && (
          <Card>
            <CardHeader>
              <CardTitle>Target Harian</CardTitle>
              <CardDescription>Kelola target harian per klinik per poli (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDDailyTarget 
                onRefresh={handleRefresh} 
                initialData={initialData?.dailyTargets}
                initialPolies={masterPolies}
                initialClinics={clinics}
                initialSources={sources}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>User Access Management</CardTitle>
              <CardDescription>Kelola akses user dengan Google SSO (Create, Read, Update, Delete)</CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDUser onRefresh={handleRefresh} initialData={initialData?.users} initialClinics={clinics} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'holidays' && (
          <Card>
            <CardHeader>
              <CardTitle>Hari Libur Nasional & Cuti Bersama</CardTitle>
              <CardDescription>
                Kelola daftar hari libur nasional dan cuti bersama (Create, Read, Update, Delete)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CRUDPublicHoliday onRefresh={handleRefresh} initialData={initialData?.publicHolidays} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'zains-sync' && <ZainsSyncSetting />}

        {activeTab === 'logs' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>System Logs</CardTitle>
                  <CardDescription>
                    Monitoring proses scraping, sinkronisasi, dan aktivitas sistem per klinik
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleRunScrapQueue}
                  disabled={runningQueue}
                  className="whitespace-nowrap"
                >
                  {runningQueue ? 'Menjalankan...' : 'Jalankan Scrap Queue'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SystemLogs clinics={clinics} initialData={initialData?.systemLogs} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
