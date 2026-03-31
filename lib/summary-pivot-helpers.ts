import type { PivotSection } from '@/lib/summary-se-yearly-types'

/** Cari vektor bulanan untuk baris pivot pertama yang cocok. */
export function findRowMonthly(
  sections: PivotSection[],
  match: (sectionTitle: string, groupTitle: string, rowLabel: string) => boolean,
): { month: number; sum: number }[] | null {
  for (const sec of sections) {
    for (const g of sec.groups) {
      for (const row of g.rows) {
        if (match(sec.title, g.title, row.label)) {
          return row.monthly
        }
      }
    }
  }
  return null
}
