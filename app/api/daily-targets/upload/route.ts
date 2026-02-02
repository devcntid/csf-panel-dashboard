import { uploadDailyTargets } from '@/lib/actions/daily-target-upload'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File harus berformat Excel (.xlsx atau .xls)' },
        { status: 400 }
      )
    }

    const result = await uploadDailyTargets(file)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Upload gagal',
          successCount: result.successCount || 0,
          failedCount: result.failedCount || 0,
          errors: result.errors || []
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil upload ${result.successCount} data, ${result.failedCount} gagal`,
      successCount: result.successCount,
      failedCount: result.failedCount,
      errors: result.errors || []
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
