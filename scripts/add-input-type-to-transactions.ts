import dotenv from 'dotenv'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local')
  process.exit(1)
}

// Use postgres client for raw SQL execution
const sql = postgres(databaseUrl)

async function addInputTypeField() {
  try {
    console.log('🔄 Memulai migration: Menambahkan field input_type ke tabel transactions...')

    // Check if column already exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
        AND column_name = 'input_type'
    `

    if (Array.isArray(columnExists) && columnExists.length > 0) {
      console.log('⚠️  Field input_type sudah ada, melewati migration...')
      await sql.end()
      process.exit(0)
    }

    // Add input_type column
    await sql`
      ALTER TABLE transactions 
      ADD COLUMN input_type VARCHAR(50) DEFAULT 'scrap'
    `

    // Update existing records to 'scrap' (default value)
    await sql`
      UPDATE transactions 
      SET input_type = 'scrap' 
      WHERE input_type IS NULL
    `

    console.log('✅ Migration berhasil! Field input_type telah ditambahkan.')
    console.log('✅ Semua transaksi yang sudah ada di-set sebagai "scrap"')

    await sql.end()
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error saat migration:', error.message)
    if (error.message) {
      console.error('Detail:', error.message)
    }
    await sql.end()
    process.exit(1)
  }
}

addInputTypeField()
