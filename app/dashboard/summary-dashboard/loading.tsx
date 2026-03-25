import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'

export default function SummaryDashboardLoading() {
  return <DataTablePageSkeleton showStatCards={false} tableRows={12} />
}
