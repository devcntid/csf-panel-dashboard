import { withAuth } from 'next-auth/middleware'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req: NextRequest) {
    const token = (req as any).nextauth?.token as
      | { role?: string; clinic_id?: number | string | null }
      | undefined

    // Jika clinic_manager mencoba akses /dashboard (executive),
    // arahkan langsung ke summary klinik miliknya.
    if (token?.role === 'clinic_manager') {
      const clinicId = token.clinic_id
      const url = req.nextUrl.clone()

      if (url.pathname === '/dashboard' && clinicId) {
        url.pathname = `/dashboard/klinik/${clinicId}`
        url.search = '' // bersihkan query di executive dashboard
        return Response.redirect(url)
      }
    }

    // Selain itu biarkan request lanjut seperti biasa.
    return null
  },
  {
    callbacks: {
      // Hanya izinkan akses jika sudah login (ada token)
      authorized: ({ token }) => !!token,
    },
  }
)

// Terapkan middleware ke semua route /dashboard (termasuk /dashboard/klinik, transaksi, pasien, dll.)
export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
}

