/**
 * Skeleton navigasi dashboard: header + opsional kartu ringkas + baris tabel.
 * Dipakai di loading.tsx agar transisi route terasa instan.
 */
export function DataTablePageSkeleton({
  showStatCards = true,
  tableRows = 8,
  showPageHeader = true,
}: {
  showStatCards?: boolean
  tableRows?: number
  /** false untuk placeholder di dalam konten (mis. Suspense di tengah halaman) */
  showPageHeader?: boolean
}) {
  return (
    <div className="min-h-[50vh] animate-pulse" aria-busy="true" aria-label="Memuat halaman">
      {showPageHeader && (
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="h-8 w-52 max-w-full bg-slate-200 rounded-md" />
          <div className="h-4 w-80 max-w-full bg-slate-100 rounded-md mt-2" />
        </header>
      )}
      <div className={showPageHeader ? 'p-6 space-y-4' : 'space-y-4'}>
        {showStatCards && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-100 rounded-lg border border-slate-200"
              />
            ))}
          </div>
        )}
        {tableRows > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="h-11 bg-slate-50 border-b border-slate-200" />
            {Array.from({ length: tableRows }, (_, i) => (
              <div
                key={i}
                className="h-12 border-b border-slate-100 flex gap-4 px-4 items-center"
              >
                <div className="h-3 flex-1 bg-slate-100 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded shrink-0" />
                <div className="h-3 w-16 bg-slate-100 rounded shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
