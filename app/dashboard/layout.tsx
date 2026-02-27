'use client'

import React from 'react'

function hexDarken(hex: string, amount: number): string {
  const m = hex.replace(/^#/, '').match(/.{2}/g)
  if (!m) return hex
  const [r, g, b] = m.map((x) => Math.max(0, Math.min(255, parseInt(x, 16) * (1 - amount))))
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // Desktop sidebar collapse
  const [clinicsExpanded, setClinicsExpanded] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userClinicId, setUserClinicId] = useState<number | null>(null)
  const [brandColor, setBrandColor] = useState('#00786F')
  const [logoUrl, setLogoUrl] = useState('/asset/logo_csf_new.png')

  useEffect(() => {
    // Redirect ke login jika belum autentikasi
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    // Load user info dari session NextAuth
    if (status === 'authenticated') {
      const user = session?.user
      setUserName(user?.name || 'User')
      setUserRole((user as any)?.role || 'User')
      const clinicId = (user as any)?.clinic_id
      setUserClinicId(typeof clinicId === 'number' ? clinicId : clinicId ? Number(clinicId) : null)
    }
    
    // Load sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('sidebar_collapsed')
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true')
    }
  }, [status, session, router])

  // App settings: brand color & logo (untuk dinamisasi)
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/settings/app')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const color = data?.app_sidebar_bg_color?.trim() || '#00786F'
        setBrandColor(color)
        document.documentElement.style.setProperty('--brand-primary', color)
        const darker = hexDarken(color, 0.1)
        document.documentElement.style.setProperty('--brand-primary-hover', darker)
        if (data?.app_logo_url) setLogoUrl(data.app_logo_url)
      })
      .catch(() => {})
  }, [status])

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const isUserReady = status === 'authenticated' && !!session?.user
  const isRoleReady = isUserReady && !!userRole
  const isClinicManager = isRoleReady && userRole === 'clinic_manager'
  const clinicSummaryHref = userClinicId ? `/dashboard/klinik/${userClinicId}` : '/dashboard'

  const menuItems = !isRoleReady
    ? []
    : isClinicManager
      ? [
          { href: clinicSummaryHref, label: 'Summary Klinik', icon: LayoutDashboard },
          { href: '/dashboard/transaksi', label: 'Data Transaksi', icon: ClipboardList },
          { href: '/dashboard/pasien', label: 'Data Pasien', icon: Users },
        ]
      : [
          { href: '/dashboard/yayasan', label: 'Dashboard Lembaga', icon: Building2 },
          { href: '/dashboard', label: 'Dashboard Klinik', icon: LayoutDashboard },
          { href: '/dashboard/summary-dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
          { href: '/dashboard/transaksi', label: 'Data Transaksi', icon: ClipboardList },
          { href: '/dashboard/pasien', label: 'Data Pasien', icon: Users },
          { href: '/dashboard/konfigurasi', label: 'Konfigurasi', icon: Settings },
        ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        style={{ backgroundColor: brandColor }}
        className={`fixed lg:static inset-y-0 left-0 z-50 text-white transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : 'lg:w-64'}`}
      >
        <div className={`flex flex-col h-full transition-all duration-300 ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : 'w-64'}`}>
          {/* Logo Section */}
          <div className="p-4 border-b border-white/20">
            <div className="relative flex items-center justify-center">
              <div className={`flex items-center justify-center transition-opacity duration-300 lg:hidden ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <div className="relative w-28 h-28 flex-shrink-0">
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    fill
                    className="object-contain brightness-0 invert"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/icon.svg';
                    }}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white hover:opacity-80 absolute right-2 top-2"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* User Info */}
          <div className={`p-4 border-b border-white/20 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden' : 'lg:opacity-100'}`}>
            {isUserReady ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{userName}</p>
                  <p className="text-white/80 text-xs">{userRole}</p>
                </div>
              </div>
            ) : (
              <div className="animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/20 rounded w-24" />
                  <div className="h-2 bg-white/10 rounded w-16" />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 py-4 overflow-y-auto transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:pointer-events-none' : 'lg:opacity-100'}`}>
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => (
                <li key={item.href}>
                  {item.subItems ? (
                    <>
                      <button
                        onClick={() => setClinicsExpanded(!clinicsExpanded)}
                        style={pathname.startsWith(item.href) ? { backgroundColor: 'rgba(255,255,255,0.2)' } : undefined}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          pathname.startsWith(item.href) ? 'border-l-3 border-white' : 'hover:opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm font-medium lg:inline hidden">{item.label}</span>
                          <span className="text-sm font-medium lg:hidden">{item.label}</span>
                        </div>
                        {clinicsExpanded ? (
                          <ChevronDown className="w-4 h-4 lg:inline hidden" />
                        ) : (
                          <ChevronRight className="w-4 h-4 lg:inline hidden" />
                        )}
                      </button>
                      {clinicsExpanded && (
                        <ul className="mt-1 ml-8 space-y-1 lg:block hidden">
                          {item.subItems.map((subItem) => (
                            <li key={subItem.href}>
                              <Link
                                href={subItem.href}
                                style={isActive(subItem.href) ? { backgroundColor: 'rgba(255,255,255,0.2)' } : undefined}
                                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${isActive(subItem.href) ? 'font-medium' : 'hover:opacity-80'}`}
                              >
                                📍 {subItem.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      style={isActive(item.href) ? { backgroundColor: 'rgba(255,255,255,0.2)' } : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive(item.href) ? 'border-l-3 border-white' : 'hover:opacity-80'
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium lg:inline hidden">{item.label}</span>
                      <span className="text-sm font-medium lg:hidden">{item.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout Button */}
          <div className={`p-4 border-t border-white/20 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden' : 'lg:opacity-100'}`}>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-white hover:opacity-80"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="lg:inline hidden">Logout</span>
              <span className="lg:hidden">Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto relative transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-0' : ''}`}>
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center h-16 px-4 lg:px-6">
            {/* Hamburger Button - Desktop */}
            <Button
              onClick={toggleSidebar}
              style={{ backgroundColor: brandColor }}
              className="hidden lg:flex mr-3 text-white shadow-sm hover:opacity-90 transition-all duration-200 rounded-lg"
              size="icon"
              title={sidebarCollapsed ? 'Tampilkan Sidebar' : 'Sembunyikan Sidebar'}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Hamburger Button - Mobile */}
            <Button
              onClick={() => setSidebarOpen(true)}
              style={{ backgroundColor: brandColor }}
              className="lg:hidden mr-3 text-white shadow-sm hover:opacity-90"
              size="icon"
            >
          <Menu className="h-5 w-5" />
        </Button>

            {/* Logo Desktop - dari app_settings */}
            <div className="hidden lg:flex items-center mr-6">
              <div className="relative w-28 h-28 flex-shrink-0">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/icon.svg';
                  }}
                />
              </div>
            </div>

            {/* Page Title Area - Right Section */}
            <div className="flex-1 flex items-center justify-between min-w-0">
              <div className="flex-1 min-w-0">
                {/* Page title will be rendered by children pages */}
              </div>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  )
}
