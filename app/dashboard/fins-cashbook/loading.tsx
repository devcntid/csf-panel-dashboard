import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'

export default function FinsCashbookLoading() {
  return <DataTablePageSkeleton showStatCards={false} tableRows={10} />
}
