'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/richtext-editor'
import { GradientPicker } from '@/components/gradient-picker'
import { toast } from 'sonner'
import { Loader2, Upload, ImageIcon } from 'lucide-react'
import { APP_SETTINGS_KEYS } from '@/lib/app-settings-keys'

const API = '/api/settings/app'
const UPLOAD_API = '/api/upload/blob'

const DEFAULT_LOGIN_CONTENT = `<h2>Kelola Klinik dengan Lebih Efisien</h2>
<p>Pantau transaksi, kelola pasien, dan optimalkan operasional klinik dalam satu dashboard yang terpadu.</p>
<ul>
<li><strong>Monitoring Real-time</strong> — Lihat progres transaksi dan aktivitas klinik secara langsung dengan update real-time.</li>
<li><strong>Tim Lebih Terkoordinasi</strong> — Berikan akses terkontrol untuk operator dan tim lapangan dengan manajemen peran yang fleksibel.</li>
<li><strong>Laporan Siap Pakai</strong> — Unduh laporan transaksi dan kehadiran pasien untuk evaluasi dan analisis operasional klinik.</li>
</ul>`

const DEFAULT_SETTINGS: Record<string, string> = {
  [APP_SETTINGS_KEYS.APP_TITLE]: 'Cita Sehat - Dashboard',
  [APP_SETTINGS_KEYS.APP_FAVICON_URL]: '/favicon.png',
  [APP_SETTINGS_KEYS.LOGO_URL]: '/asset/logo_csf_new.png',
  [APP_SETTINGS_KEYS.SIDEBAR_BG_COLOR]: '#00786F',
  [APP_SETTINGS_KEYS.COMPANY_NAME]: 'Cita Sehat Foundation',
  [APP_SETTINGS_KEYS.LOGIN_CONTENT]: DEFAULT_LOGIN_CONTENT,
  [APP_SETTINGS_KEYS.LOGIN_TONE_BG]:
    'linear-gradient(to bottom right, rgba(19,78,74,0.85), rgba(25,58,58,0.75), rgba(30,58,138,0.85))',
  [APP_SETTINGS_KEYS.LOGIN_BG_IMAGE]: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d',
}

export function AppSettingsForm() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      const data = await res.json()
      if (res.ok && typeof data === 'object' && data !== null) {
        setSettings({ ...DEFAULT_SETTINGS, ...data })
      }
    } catch {
      toast.error('Gagal memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleUpload = async (type: 'logo' | 'login_bg' | 'favicon', file: File) => {
    const setUploading =
      type === 'logo' ? setUploadingLogo : type === 'login_bg' ? setUploadingBg : setUploadingFavicon
    const key =
      type === 'logo'
        ? APP_SETTINGS_KEYS.LOGO_URL
        : type === 'login_bg'
          ? APP_SETTINGS_KEYS.LOGIN_BG_IMAGE
          : APP_SETTINGS_KEYS.APP_FAVICON_URL
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', type)
      const res = await fetch(UPLOAD_API, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Gagal upload')
        return
      }
      if (data?.url) {
        update(key, data.url)
        toast.success(
          type === 'logo'
            ? 'Logo berhasil di-upload'
            : type === 'login_bg'
              ? 'Background berhasil di-upload'
              : 'Favicon berhasil di-upload'
        )
      }
    } catch {
      toast.error('Gagal upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Gagal menyimpan')
        return
      }
      setSettings((prev) => ({ ...prev, ...data }))
      toast.success('Pengaturan berhasil disimpan')
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
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
        <CardTitle>Pengaturan Aplikasi (Dinamis)</CardTitle>
        <CardDescription>
          Logo, warna sidebar, nama perusahaan, teks halaman login, tone & background login. Perubahan berlaku di seluruh aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label>Judul aplikasi (title tab browser)</Label>
          <Input
            value={settings[APP_SETTINGS_KEYS.APP_TITLE] ?? ''}
            onChange={(e) => update(APP_SETTINGS_KEYS.APP_TITLE, e.target.value)}
            placeholder="Cita Sehat - Dashboard"
          />
        </div>

        <div className="grid gap-2">
          <Label>Favicon (ikon tab browser)</Label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
              {(settings[APP_SETTINGS_KEYS.APP_FAVICON_URL] ?? '').startsWith('http') ||
              (settings[APP_SETTINGS_KEYS.APP_FAVICON_URL] ?? '').startsWith('/') ? (
                <img
                  src={settings[APP_SETTINGS_KEYS.APP_FAVICON_URL] ?? ''}
                  alt="Favicon"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/x-icon"
                  className="hidden"
                  id="upload-favicon"
                  aria-label="Pilih file favicon"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload('favicon', f)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFavicon}
                  onClick={() => document.getElementById('upload-favicon')?.click()}
                >
                  {uploadingFavicon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {uploadingFavicon ? 'Uploading...' : 'Upload ke Vercel Blob'}
                </Button>
              </div>
              <Input
                value={settings[APP_SETTINGS_KEYS.APP_FAVICON_URL] ?? ''}
                onChange={(e) => update(APP_SETTINGS_KEYS.APP_FAVICON_URL, e.target.value)}
                placeholder="/favicon.png atau URL"
                className="text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">Upload PNG/ICO/JPEG/WebP/SVG (maks 4 MB) atau isi URL manual.</p>
        </div>

        <div className="grid gap-2">
          <Label>Logo utama</Label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
              {(settings[APP_SETTINGS_KEYS.LOGO_URL] ?? '').startsWith('http') || (settings[APP_SETTINGS_KEYS.LOGO_URL] ?? '').startsWith('/') ? (
                <img
                  src={settings[APP_SETTINGS_KEYS.LOGO_URL] ?? ''}
                  alt="Preview logo"
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  id="upload-logo"
                  aria-label="Pilih file logo"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload('logo', f)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById('upload-logo')?.click()}
                >
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploadingLogo ? 'Uploading...' : 'Upload ke Vercel Blob'}
                </Button>
              </div>
              <Input
                value={settings[APP_SETTINGS_KEYS.LOGO_URL] ?? ''}
                onChange={(e) => update(APP_SETTINGS_KEYS.LOGO_URL, e.target.value)}
                placeholder="/asset/logo.png atau URL"
                className="text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">Upload PNG/JPEG/WebP/SVG (maks 4 MB) atau isi URL manual.</p>
        </div>

        <div className="grid gap-2">
          <Label>Warna background sidebar & aksen (hex, misal #00786F)</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pilih warna sidebar"
              title="Pilih warna"
              value={settings[APP_SETTINGS_KEYS.SIDEBAR_BG_COLOR]?.replace(/^#?/, '#') || '#00786F'}
              onChange={(e) => update(APP_SETTINGS_KEYS.SIDEBAR_BG_COLOR, e.target.value)}
              className="h-10 w-14 rounded border border-slate-200 cursor-pointer"
            />
            <Input
              value={settings[APP_SETTINGS_KEYS.SIDEBAR_BG_COLOR] ?? ''}
              onChange={(e) => update(APP_SETTINGS_KEYS.SIDEBAR_BG_COLOR, e.target.value)}
              placeholder="#00786F"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-slate-500">
            Warna ini dipakai untuk sidebar kiri, tombol utama, dan font aksen di dashboard.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Nama perusahaan (copyright di login)</Label>
          <Input
            value={settings[APP_SETTINGS_KEYS.COMPANY_NAME] ?? ''}
            onChange={(e) => update(APP_SETTINGS_KEYS.COMPANY_NAME, e.target.value)}
            placeholder="Cita Sehat Foundation"
          />
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium text-slate-800">Teks halaman login (richtext)</h4>
          <p className="text-sm text-slate-500">
            Satu blok untuk semua teks di sisi kanan halaman login. Gunakan <strong>List</strong> (bullet) untuk tiap poin atau ganti baris dengan Enter. Judul bisa pakai heading, teks tebal untuk subjudul poin.
          </p>
          <div className="grid gap-2">
            <RichTextEditor
              value={settings[APP_SETTINGS_KEYS.LOGIN_CONTENT] ?? DEFAULT_LOGIN_CONTENT}
              onChange={(html) => update(APP_SETTINGS_KEYS.LOGIN_CONTENT, html)}
              minHeight="280px"
            />
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium text-slate-800">Background halaman login</h4>
          <div className="grid gap-2">
            <Label>Warna overlay (gradient)</Label>
            <p className="text-sm text-slate-500">
              Geser slider, pilih arah, dan klik warna untuk mengubah tone overlay di atas gambar background. Preview tampil di bawah.
            </p>
            <GradientPicker
              value={settings[APP_SETTINGS_KEYS.LOGIN_TONE_BG] ?? ''}
              onChange={(css) => update(APP_SETTINGS_KEYS.LOGIN_TONE_BG, css)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Gambar background login</Label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-32 h-20 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                {(settings[APP_SETTINGS_KEYS.LOGIN_BG_IMAGE] ?? '').startsWith('http') ? (
                  <img
                    src={settings[APP_SETTINGS_KEYS.LOGIN_BG_IMAGE] ?? ''}
                    alt="Preview background"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex gap-2 items-center">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    id="upload-login-bg"
                    aria-label="Pilih file background login"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload('login_bg', f)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingBg}
                    onClick={() => document.getElementById('upload-login-bg')?.click()}
                  >
                    {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {uploadingBg ? 'Uploading...' : 'Upload ke Vercel Blob'}
                  </Button>
                </div>
                <Input
                  value={settings[APP_SETTINGS_KEYS.LOGIN_BG_IMAGE] ?? ''}
                  onChange={(e) => update(APP_SETTINGS_KEYS.LOGIN_BG_IMAGE, e.target.value)}
                  placeholder="https://... atau upload di atas"
                  className="text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">Upload PNG/JPEG/WebP (maks 4 MB) atau isi URL manual.</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-[var(--brand-primary,#00786F)] hover:opacity-90">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            'Simpan pengaturan'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
