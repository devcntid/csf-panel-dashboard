import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user?: {
      id?: string
      name?: string | null
      email?: string | null
      role?: string | null
      clinic_id?: number | null
    }
  }

  interface User {
    role?: string | null
    clinic_id?: number | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string | null
    clinic_id?: number | null
  }
}
