'use server'

import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

// Download template Excel untuk upload target harian
export async function downloadDailyTargetTemplate() {
  try {
    // Get all clinics dan polies yang ada di config
    const configs = await sql`
      SELECT DISTINCT
        c.id as clinic_id,
        c.name as clinic_name,
        mp.id as poly_id,
        mp.name as poly_name
      FROM clinic_target_configs ctc
      JOIN clinics c ON c.id = ctc.clinic_id
      JOIN master_polies mp ON mp.id = ctc.master_poly_id
      ORDER BY c.name, mp.name
    `

    // Ambil semua sources
    const sources = await sql`
      SELECT id, name FROM sources ORDER BY name
    `;

    // Prepare data untuk Excel
    const today = new Date().toISOString().split('T')[0]
    const excelData = [
      // Header
      [
        'clinic_id',
        'master_poly_id',
        'source_id',
        'target_date',
        'target_visits',
        'target_revenue',
        'tipe_donatur',  // retail | corporate | community
        'nama_klinik',   // Helper column, akan di-skip saat upload
        'nama_poli',     // Helper column, akan di-skip saat upload
        'nama_source',   // Helper column, akan di-skip saat upload
      ],
      // Sample data - untuk setiap kombinasi klinik-poli, buat 1 baris per source
      ...configs.flatMap((config: any) =>
        sources.map((source: any) => [
          config.clinic_id,
          config.poly_id,
          source.id,
          today,           // Sample tanggal
          10,              // Sample visits
          500000,          // Sample revenue
          'retail',        // Sample tipe donatur
          config.clinic_name,
          config.poly_name,
          source.name,
        ])
      ),
      // Empty rows untuk user input (opsional)
      ...Array(10).fill(null).map(() => [
        '', '', '', '', '', '', '', '', '', '',
      ]),
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // clinic_id
      { wch: 15 }, // master_poly_id
      { wch: 12 }, // target_date
      { wch: 15 }, // target_visits
      { wch: 15 }, // target_revenue
      { wch: 15 }, // tipe_donatur
      { wch: 30 }, // nama_klinik
      { wch: 25 }, // nama_poli
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Target Harian')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return {
      success: true,
      buffer: excelBuffer,
      filename: `template-upload-target-harian-${new Date().toISOString().split('T')[0]}.xlsx`
    }
  } catch (error: any) {
    console.error('Error generating template:', error)
    return { success: false, error: error.message }
  }
}

// Upload dan parse Excel untuk target harian
export async function uploadDailyTargets(file: File) {
  try {
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (data.length < 2) {
      return { success: false, error: 'File Excel kosong atau tidak valid' }
    }

    // Get header row
    const headers = data[0] as string[]
    const expectedHeaders = [
      'clinic_id',
      'master_poly_id',
      'source_id',
      'target_date',
      'target_visits',
      'target_revenue',
      'tipe_donatur',
    ]
    
    // Validate headers (skip nama_klinik and nama_poli)
    const requiredHeaders = expectedHeaders.filter(h => headers.includes(h))
    if (requiredHeaders.length !== expectedHeaders.length) {
      return { 
        success: false, 
        error: `Header tidak valid. Header yang diperlukan: ${expectedHeaders.join(', ')}` 
      }
    }

    // Get column indices
    const clinicIdIdx = headers.indexOf('clinic_id')
    const polyIdIdx = headers.indexOf('master_poly_id')
    const sourceIdIdx = headers.indexOf('source_id')
    const dateIdx = headers.indexOf('target_date')
    const visitsIdx = headers.indexOf('target_visits')
    const revenueIdx = headers.indexOf('target_revenue')
    const tipeIdx = headers.indexOf('tipe_donatur')

    // Validate all clinics, polies, and sources exist
    const allClinics = await sql`SELECT id FROM clinics`
    const allPolies = await sql`SELECT id FROM master_polies`
    const allSources = await sql`SELECT id FROM sources`
    const clinicIds = new Set(allClinics.map((c: any) => c.id.toString()))
    const polyIds = new Set(allPolies.map((p: any) => p.id.toString()))
    const sourceIds = new Set(allSources.map((s: any) => s.id.toString()))

    // Process rows (skip header)
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      
      // Skip empty rows
      if (!row[clinicIdIdx] || !row[polyIdIdx] || !row[sourceIdIdx] || !row[dateIdx]) {
        continue
      }

      const clinicId = parseInt(row[clinicIdIdx])
      const polyId = parseInt(row[polyIdIdx])
      const sourceId = parseInt(row[sourceIdIdx])
      const targetDate = row[dateIdx]
      const targetVisits = parseFloat(row[visitsIdx] || '0')
      const targetRevenue = parseFloat(row[revenueIdx] || '0')
      const rawTipe = tipeIdx >= 0 && row[tipeIdx] != null ? String(row[tipeIdx]).trim().toLowerCase() : ''
      let tipeDonatur: 'retail' | 'corporate' | 'community' | null = null

      if (rawTipe) {
        if (rawTipe === 'retail' || rawTipe === 'corporate' || rawTipe === 'community') {
          tipeDonatur = rawTipe as 'retail' | 'corporate' | 'community'
        } else {
          results.failed++
          results.errors.push(`Baris ${i + 1}: tipe_donatur harus salah satu dari retail, corporate, community atau kosong`)
          continue
        }
      }

      // Validate clinic_id
      if (!clinicIds.has(clinicId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: clinic_id ${clinicId} tidak ditemukan`)
        continue
      }

      // Validate poly_id
      if (!polyIds.has(polyId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: master_poly_id ${polyId} tidak ditemukan`)
        continue
      }

      // Validate source_id
      if (!sourceIds.has(sourceId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: source_id ${sourceId} tidak ditemukan`)
        continue
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: Format tanggal tidak valid (harus YYYY-MM-DD)`)
        continue
      }

      // Validate numbers
      if (isNaN(targetVisits) || targetVisits < 0) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_visits harus berupa angka >= 0`)
        continue
      }

      if (isNaN(targetRevenue) || targetRevenue < 0) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_revenue harus berupa angka >= 0`)
        continue
      }

      // Insert or update (ON CONFLICT)
      try {
        await sql`
          INSERT INTO clinic_daily_targets (
            clinic_id, 
            master_poly_id, 
            source_id,
            target_date, 
            target_visits, 
            target_revenue,
            tipe_donatur
          )
          VALUES (
            ${clinicId},
            ${polyId},
            ${sourceId},
            ${targetDate},
            ${targetVisits},
            ${targetRevenue},
            ${tipeDonatur}
          )
          ON CONFLICT (clinic_id, target_date, master_poly_id, source_id) 
          DO UPDATE SET
            target_visits = EXCLUDED.target_visits,
            target_revenue = EXCLUDED.target_revenue,
            tipe_donatur = EXCLUDED.tipe_donatur,
            updated_at = NOW()
        `
        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: ${error.message}`)
      }
    }

    revalidatePath('/dashboard/konfigurasi')

    return {
      success: results.success > 0,
      successCount: results.success,
      failedCount: results.failed,
      errors: results.errors.slice(0, 20) // Limit errors to first 20
    }
  } catch (error: any) {
    console.error('Error uploading daily targets:', error)
    return { success: false, error: error.message }
  }
}
