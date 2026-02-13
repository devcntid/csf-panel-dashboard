'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw, Send } from 'lucide-react'

const API = '/api/settings/zains-transaction-sync'

export function ZainsSyncSetting() {
  const [enabled, setEnabled] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activatingAll, setActivatingAll] = useState(false)

  const fetchSetting = async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      const data = await res.json()
      if (res.ok && typeof data.enabled === 'boolean') setEnabled(data.enabled)
    } catch {
      toast.error('Gagal memuat pengaturan sync Zains')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSetting()
  }, [])

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Gagal menyimpan pengaturan')
        return
      }
      setEnabled(checked)
      toast.success(checked ? 'Sync transaksi ke Zains diaktifkan' : 'Sync transaksi ke Zains dimatikan')
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleActivateAllPending = async () => {
    setActivatingAll(true)
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, activateAllPending: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Gagal mengaktifkan semua pending')
        return
      }
      setEnabled(true)
      toast.success('Semua data pending akan ikut di-sync ke Zains (cron/workflow)')
    } catch {
      toast.error('Gagal mengaktifkan semua pending')
    } finally {
      setActivatingAll(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500">Memuat pengaturan...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Transaksi ke Zains</CardTitle>
        <CardDescription>
          Toggle global untuk mengirim transaksi ke Zains. Matikan sementara jika tidak ingin ada POST ke API Zains (cron & workflow tetap jalan tapi tidak memproses data). Nyalakan lagi kapan saja; data baru (manual/upload) akan mengikuti nilai toggle saat insert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="zains-sync-toggle" className="text-base font-medium">
              Sync transaksi ke Zains
            </Label>
            <p className="text-sm text-slate-500">
              {enabled
                ? 'Aktif — cron dan workflow akan mengirim transaksi yang todo_zains = true ke Zains.'
                : 'Nonaktif — tidak ada transaksi yang di-POST ke Zains.'}
            </p>
          </div>
          <Switch
            id="zains-sync-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        {enabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">Aktifkan semua data pending</p>
            <p className="text-sm text-amber-700/90 mb-3">
              Jika sebelumnya sync pernah dimatikan, data yang masuk saat itu punya todo_zains = false. Klik tombol di bawah agar semua record yang belum sync (synced = false) di-set todo_zains = true sehingga ikut di-sync saat cron atau workflow jalan.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleActivateAllPending}
              disabled={activatingAll}
              className="border-amber-300 bg-white hover:bg-amber-100"
            >
              {activatingAll ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Aktifkan semua data pending ke Zains
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
