'use client'

import { Button } from '@/components/ui/button'
import { Filter, Upload } from 'lucide-react'

export function TransaksiHeader({ 
  onToggleFilter, 
  showFilter,
  onOpenUpload 
}: { 
  onToggleFilter: () => void
  showFilter: boolean
  onOpenUpload?: () => void
}) {

  return (
    <header className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Data Transaksi</h2>
          <p className="text-slate-500 text-sm">Real-time data hasil scraping dari eClinic</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className={`border-slate-300 bg-transparent ${showFilter ? 'bg-teal-50 border-teal-300' : ''}`}
            onClick={onToggleFilter}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          {onOpenUpload && (
            <Button 
              variant="outline" 
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={onOpenUpload}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
