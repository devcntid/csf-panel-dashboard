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

async function addPaidActionAfterDiscountField() {
  try {
    console.log('🔄 Memulai migration: Menambahkan field paid_action_after_discount ke tabel transactions...')

    // Check if column already exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
        AND column_name = 'paid_action_after_discount'
    `

    if (Array.isArray(columnExists) && columnExists.length > 0) {
      console.log('⚠️  Field paid_action_after_discount sudah ada, melewati migration...')
      await sql.end()
      process.exit(0)
    }

    // Add paid_action_after_discount column dengan type yang sama dengan paid_action
    await sql`
      ALTER TABLE transactions 
      ADD COLUMN paid_action_after_discount DECIMAL(15, 2) DEFAULT 0
    `

    // Update existing records: jika paid_discount > 0 maka paid_action_after_discount = paid_action - paid_discount
    // Jika tidak ada diskon, paid_action_after_discount = paid_action
    await sql`
      UPDATE transactions 
      SET paid_action_after_discount = CASE 
        WHEN paid_discount > 0 THEN paid_action - paid_discount
        ELSE paid_action
      END
      WHERE paid_action_after_discount IS NULL OR paid_action_after_discount = 0
    `

    console.log('✅ Migration berhasil! Field paid_action_after_discount telah ditambahkan.')
    console.log('✅ Data existing telah di-update dengan logika: jika paid_discount > 0 maka paid_action_after_discount = paid_action - paid_discount')

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

addPaidActionAfterDiscountField()
