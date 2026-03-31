import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'

export default function FinancialVisualLoading() {
  return <DataTablePageSkeleton showStatCards tableRows={8} />
}
