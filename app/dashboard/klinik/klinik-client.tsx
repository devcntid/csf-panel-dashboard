'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export function KlinikClient({ clinic }: { clinic: any }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-slate-600">URL eClinic</Label>
        <Input
          type="text"
          defaultValue={clinic.login_url || ''}
          className="text-sm"
          readOnly
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Username</Label>
        <Input
          type="text"
          defaultValue={clinic.username || ''}
          className="text-sm"
          readOnly
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Password</Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            defaultValue={clinic.password_encrypted ? '••••••••' : ''}
            className="text-sm pr-10"
            readOnly
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
