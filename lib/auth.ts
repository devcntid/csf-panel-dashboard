import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { sql } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  pages: {
    signIn: '/login',
    // Error akan di-handle oleh route handler di /app/api/auth/error/route.ts
    // yang akan redirect ke /login dengan parameter error
  },
  session: {
    strategy: 'jwt',
    // Session berlaku 8 jam, setelah itu user otomatis logout
    maxAge: 60 * 60 * 8,
  },
  callbacks: {
    // Hanya izinkan login jika email ada di tabel users
    async signIn({ user }) {
      if (!user.email) return false

      try {
        const users = await sql`
          SELECT id, full_name, role, clinic_id
          FROM users
          WHERE email = ${user.email}
          LIMIT 1
        `
        const dbUser = Array.isArray(users) ? users[0] : users

        if (!dbUser) {
          // Email tidak terdaftar di tabel users
          return false
        }

        // Tambahkan info user dari database ke objek user
        ;(user as any).id = String(dbUser.id)
        ;(user as any).name = dbUser.full_name || user.name
        ;(user as any).role = dbUser.role
        ;(user as any).clinic_id = dbUser.clinic_id

        return true
      } catch (error) {
        console.error('Error checking user in signIn callback:', error)
        return false
      }
    },
    async jwt({ token, user }) {
      // Saat pertama kali login, merge data user ke token
      if (user) {
        token.role = (user as any).role
        token.clinic_id = (user as any).clinic_id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // token.sub adalah user.id dari provider
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).clinic_id = (token as any).clinic_id
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
