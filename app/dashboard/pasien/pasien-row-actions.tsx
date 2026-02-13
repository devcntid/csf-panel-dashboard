'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deletePatient } from '@/lib/actions/patients'

export function PasienRowActions({
  patientId,
  patientName,
}: {
  patientId: number
  patientName?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const label = patientName || `Pasien #${patientId}`

  const handleConfirmDelete = async () => {
    const result = await deletePatient(patientId)
    setOpen(false)
    if (result.success) {
      toast.success('Pasien berhasil dihapus')
      router.refresh()
    } else {
      toast.error(result.error || 'Gagal menghapus pasien')
    }
  }

  return (
    <>
      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="ghost" className="text-teal-600" asChild>
          <Link href={`/dashboard/pasien/${patientId}`}>Detail</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Hapus
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pasien?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{label}</strong> beserta semua transaksi dan data transactions_to_zains akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Ya, Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
