import { NextResponse } from 'next/server'

// Endpoint untuk men-trigger proses scrap queue secara manual via GitHub Actions
// AMAN untuk Vercel production: tidak menjalankan Playwright di Vercel,
// tapi trigger GitHub Actions workflow yang jalan di runner GitHub

export async function POST() {
  try {
    // Cek apakah ada GitHub Actions token untuk trigger workflow
    const githubToken = process.env.GITHUB_ACTIONS_TOKEN
    const githubRepo = process.env.GITHUB_REPO // Format: "owner/repo" (e.g., "username/csf-panel-dashboard")
    const githubRef = process.env.GITHUB_REF || 'main' // Branch default

    if (!githubToken || !githubRepo) {
      console.warn(
        '[scrap:queue] GITHUB_ACTIONS_TOKEN atau GITHUB_REPO tidak ditemukan. ' +
        'Silakan set di Vercel Environment Variables untuk enable manual trigger dari UI.'
      )
      
      // Fallback: return success tapi dengan warning
      // User masih bisa trigger manual di GitHub Actions tab
      return NextResponse.json({
        success: true,
        message: 'Scrap queue akan diproses pada cron berikutnya (30 menit). ' +
                 'Untuk trigger segera, gunakan GitHub Actions → Scrap Queue Worker → Run workflow',
        note: 'Untuk enable trigger dari UI, set GITHUB_ACTIONS_TOKEN dan GITHUB_REPO di Vercel env vars',
      })
    }

    // Trigger GitHub Actions workflow via API
    const workflowId = 'scrap-queue.yml' // Nama file workflow
    const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: githubRef, // Branch yang akan di-trigger
        inputs: {}, // Optional: bisa kirim parameter tambahan kalau perlu
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[scrap:queue] GitHub Actions API error:', response.status, errorText)
      
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal trigger GitHub Actions workflow',
          error: `GitHub API returned ${response.status}: ${errorText}`,
        },
        { status: 500 }
      )
    }

    console.log('[scrap:queue] GitHub Actions workflow triggered successfully')

    return NextResponse.json({
      success: true,
      message: 'Scrap queue worker telah di-trigger via GitHub Actions. Proses akan berjalan dalam beberapa detik.',
    })
  } catch (error: any) {
    console.error('[scrap:queue] Error men-trigger worker:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal men-trigger scrap queue worker',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

