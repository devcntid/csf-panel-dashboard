import { sql } from '@/lib/db'

// Create scrape_queue table untuk menyimpan manual scrap requests
async function createScrapQueueTable() {
  try {
    console.log('Creating scrap_queue table...')
    
    await sql`
      CREATE TABLE IF NOT EXISTS scrap_queue (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        tgl_awal DATE NOT NULL,
        tgl_akhir DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        requested_by VARCHAR(255),
        error_message TEXT,
        github_run_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES klinik(id) ON DELETE CASCADE
      )
    `
    
    // Create index untuk faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_scrap_queue_status ON scrap_queue(status)
    `
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_scrap_queue_clinic ON scrap_queue(clinic_id)
    `
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_scrap_queue_created_at ON scrap_queue(created_at DESC)
    `
    
    console.log('✅ scrap_queue table created successfully')
  } catch (error) {
    console.error('❌ Error creating scrap_queue table:', error)
    throw error
  }
}

createScrapQueueTable().catch((err) => {
  console.error(err)
  process.exit(1)
})
