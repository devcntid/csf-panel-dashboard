import * as dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local')
  process.exit(1)
}

const sql = postgres(databaseUrl)

async function addSourceIdContactColumns() {
  try {
    console.log('🔄 Menambahkan kolom only_id_contact / exclude_id_contact ke tabel sources...')

    const sourceColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sources'
    `

    const sourceCols = new Set(sourceColumns.map((c: { column_name: string }) => c.column_name))

    if (!sourceCols.has('only_id_contact')) {
      await sql`ALTER TABLE sources ADD COLUMN only_id_contact TEXT`
      console.log('✅ Kolom sources.only_id_contact berhasil ditambahkan')
    } else {
      console.log('ℹ️  Kolom sources.only_id_contact sudah ada, dilewati')
    }

    if (!sourceCols.has('exclude_id_contact')) {
      await sql`ALTER TABLE sources ADD COLUMN exclude_id_contact TEXT`
      console.log('✅ Kolom sources.exclude_id_contact berhasil ditambahkan')
    } else {
      console.log('ℹ️  Kolom sources.exclude_id_contact sudah ada, dilewati')
    }

    console.log('✅ Migrasi source id_contact selesai')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

addSourceIdContactColumns()
