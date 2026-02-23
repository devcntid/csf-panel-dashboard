import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

const MAX_SIZE = 4 * 1024 * 1024 // 4 MB (Vercel serverless limit ~4.5 MB)
const ALLOWED_TYPES = ['logo', 'login_bg', 'favicon'] as const
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/x-icon']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file || !type || !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json(
        { error: 'Bad request: file dan type (logo | login_bg | favicon) wajib' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File terlalu besar. Maksimal 4 MB.' },
        { status: 400 }
      )
    }

    const contentType = file.type
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Format tidak didukung. Gunakan PNG, JPEG, WebP, atau SVG.' },
        { status: 400 }
      )
    }

    const ext =
      contentType === 'image/svg+xml'
        ? 'svg'
        : contentType === 'image/x-icon'
          ? 'ico'
          : contentType.split('/')[1] || 'png'
    const pathname = `app-settings/${type}-${Date.now()}.${ext}`

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error: any) {
    console.error('Upload blob error:', error)
    if (error?.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      return NextResponse.json(
        { error: 'Vercel Blob belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN di environment.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Gagal upload file' },
      { status: 500 }
    )
  }
}
