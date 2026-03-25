import { DataTablePageSkeleton } from '@/components/dashboard/data-table-page-skeleton'

export default function Loading() {
  return <DataTablePageSkeleton showStatCards tableRows={10} />
}
