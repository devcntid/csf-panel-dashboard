import { sql } from '@/lib/db'

/**
 * Cleanup old scrap_queue items
 * - Delete completed items older than 7 days
 * - Delete failed items older than 30 days
 * - Keep pending and processing items (they might still be needed)
 */
async function cleanupScrapQueue() {
  try {
    console.log('🧹 Starting scrap_queue cleanup...')

    // Count items to be deleted first
    const [completedCount] = await sql`
      SELECT COUNT(*) as count
      FROM scrap_queue
      WHERE status = 'completed'
        AND completed_at < NOW() - INTERVAL '7 days'
    ` as Array<{ count: number }>
    
    // Delete completed items older than 7 days
    await sql`
      DELETE FROM scrap_queue
      WHERE status = 'completed'
        AND completed_at < NOW() - INTERVAL '7 days'
    `
    const completedDeleted = completedCount?.count || 0
    console.log(`✅ Deleted ${completedDeleted} completed items older than 7 days`)

    // Count items to be deleted first
    const [failedCount] = await sql`
      SELECT COUNT(*) as count
      FROM scrap_queue
      WHERE status = 'failed'
        AND updated_at < NOW() - INTERVAL '30 days'
    ` as Array<{ count: number }>
    
    // Delete failed items older than 30 days
    await sql`
      DELETE FROM scrap_queue
      WHERE status = 'failed'
        AND updated_at < NOW() - INTERVAL '30 days'
    `
    const failedDeleted = failedCount?.count || 0
    console.log(`✅ Deleted ${failedDeleted} failed items older than 30 days`)

    // Get current queue stats
    const stats = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM scrap_queue
      GROUP BY status
      ORDER BY status
    ` as Array<{
      status: string
      count: number
      oldest: Date | null
      newest: Date | null
    }>

    console.log('\n📊 Current queue stats:')
    stats.forEach((stat) => {
      console.log(
        `  ${stat.status}: ${stat.count} items` +
        (stat.oldest ? ` (oldest: ${stat.oldest.toISOString()})` : '')
      )
    })

    const totalDeleted = completedDeleted + failedDeleted
    console.log(`\n✅ Cleanup completed. Total deleted: ${totalDeleted} items`)
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Run cleanup
cleanupScrapQueue()
  .then(() => {
    console.log('✅ Cleanup script completed successfully')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Cleanup script failed:', err)
    process.exit(1)
  })
