import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Save, UserPlus } from 'lucide-react'
import { getMasterPolies, getMasterInsuranceTypes, getUsers, getAllClinics, getSources } from '@/lib/actions/config'
import { getClinicsPaginated, getMasterPoliesPaginated, getTargetCategoriesPaginated, getUsersPaginated, getDailyTargetsPaginated, getSystemLogsPaginated, getPolyMappingsPaginated, getInsuranceMappingsPaginated, getInsuranceTypesPaginated } from '@/lib/actions/pagination'
import { getTargetConfigs, getPublicHolidays } from '@/lib/actions/crud'
import { KonfigurasiTabs } from './konfigurasi-tabs'

export default async function KonfigurasiPage() {
  // Parallel fetching untuk performa maksimal - fetch semua data awal untuk semua tab
  const [mappingsPaginated, insuranceMappingsPaginated, masterPolies, masterInsuranceTypes, users, clinics, sources, clinicsPaginated, poliesPaginated, categoriesPaginated, usersPaginated, targetConfigs, dailyTargets, systemLogs, insuranceTypesPaginated, publicHolidays] = await Promise.all([
    getPolyMappingsPaginated(undefined, undefined, undefined, 1, 10),
    getInsuranceMappingsPaginated(undefined, undefined, undefined, 1, 10),
    getMasterPolies(),
    getMasterInsuranceTypes(),
    getUsers(),
    getAllClinics(),
    getSources(),
    getClinicsPaginated(1, 10),
    getMasterPoliesPaginated(1, 10),
    getTargetCategoriesPaginated(1, 10),
    getUsersPaginated(1, 10),
    getTargetConfigs(undefined, undefined, undefined, 1, 10),
    getDailyTargetsPaginated(undefined, undefined, undefined, undefined, 1, 10),
    getSystemLogsPaginated(undefined, undefined, undefined, undefined, undefined, undefined, 1, 10),
    getInsuranceTypesPaginated(1, 10),
    getPublicHolidays(undefined, 1, 10)
  ])

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Konfigurasi</h2>
            <p className="text-slate-500 text-sm">Pengaturan Mapping Poliklinik & User Access</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <KonfigurasiTabs
          masterPolies={masterPolies}
          masterInsuranceTypes={masterInsuranceTypes}
          users={users}
          clinics={clinics}
          sources={sources}
          initialData={{
            mappings: mappingsPaginated,
            insuranceMappings: insuranceMappingsPaginated,
            clinics: clinicsPaginated,
            polies: poliesPaginated,
            categories: categoriesPaginated,
            users: usersPaginated,
            targetConfigs: targetConfigs,
            dailyTargets: dailyTargets,
            systemLogs: systemLogs,
            insuranceTypes: insuranceTypesPaginated,
            publicHolidays: publicHolidays
          }}
        />
      </div>
    </div>
  )
}
