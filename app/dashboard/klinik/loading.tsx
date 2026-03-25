import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'

export default function KlinikLoading() {
  return <DataTablePageSkeleton showStatCards={false} tableRows={6} />
}
