import { downloadDailyTargetTemplate } from '@/lib/actions/daily-target-upload'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await downloadDailyTargetTemplate()
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate template' },
        { status: 500 }
      )
    }

    return new NextResponse(result.buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error downloading template:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
