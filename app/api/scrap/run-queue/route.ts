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

    // Trigger GitHub Actions workflow via API dengan retry logic
    const workflowId = 'scrap-queue.yml' // Nama file workflow
    const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`

    // Retry logic: coba sampai 3 kali dengan delay
    let lastError: any = null
    let success = false

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
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

        if (response.ok) {
          console.log(`[scrap:queue] GitHub Actions workflow triggered successfully (attempt ${attempt})`)
          success = true
          break
        }

        // Jika 429 (rate limit) atau 503 (service unavailable), retry dengan delay
        if (response.status === 429 || response.status === 503) {
          const errorText = await response.text()
          console.warn(`[scrap:queue] GitHub API rate limit/service unavailable (attempt ${attempt}/3):`, errorText)
          
          if (attempt < 3) {
            // Exponential backoff: 2s, 4s, 8s
            const delayMs = Math.pow(2, attempt) * 1000
            console.log(`[scrap:queue] Retrying in ${delayMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }
        }

        // Error lain, langsung throw
        const errorText = await response.text()
        lastError = { status: response.status, message: errorText }
        console.error(`[scrap:queue] GitHub Actions API error (attempt ${attempt}):`, response.status, errorText)
        break

      } catch (fetchError: any) {
        lastError = fetchError
        console.error(`[scrap:queue] Fetch error (attempt ${attempt}):`, fetchError.message)
        
        if (attempt < 3) {
          const delayMs = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal trigger GitHub Actions workflow setelah 3 kali percobaan',
          error: lastError?.message || `GitHub API returned ${lastError?.status || 'unknown error'}`,
          note: 'Job akan tetap diproses pada cron berikutnya (30 menit) atau trigger manual di GitHub Actions',
        },
        { status: 500 }
      )
    }

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

