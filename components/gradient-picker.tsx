'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DIRECTIONS = [
  { value: 'to bottom right', label: 'Diagonal kanan bawah' },
  { value: 'to right', label: 'Ke kanan' },
  { value: 'to bottom', label: 'Ke bawah' },
  { value: 'to top', label: 'Ke atas' },
  { value: 'to top right', label: 'Diagonal kanan atas' },
  { value: 'to bottom left', label: 'Diagonal kiri bawah' },
  { value: 'to top left', label: 'Diagonal kiri atas' },
  { value: 'to left', label: 'Ke kiri' },
] as const

function hexToRgba(hex: string, a: number): string {
  const m = hex.replace(/^#/, '').match(/.{2}/g)
  if (!m) return `rgba(0,0,0,${a})`
  const [r, g, b] = m.map((x) => parseInt(x, 16))
  return `rgba(${r},${g},${b},${a})`
}

/** Parse CSS linear-gradient string to direction + hex colors + opacity */
function parseGradientCss(css: string): { direction: string; colors: [string, string, string]; opacity: number } {
  const defaultResult = {
    direction: 'to bottom right',
    colors: ['#134e4a', '#193a3a', '#1e3a8a'] as [string, string, string],
    opacity: 0.85,
  }
  if (!css || !css.includes('linear-gradient')) return defaultResult
  const match = css.match(/linear-gradient\s*\(\s*(to\s+[^,]+|[0-9]+deg)\s*,\s*(.+)\)/i)
  if (!match) return defaultResult
  const [, dir, rest] = match
  const direction = dir?.trim() || defaultResult.direction
  const parts = rest?.split(/\s*,\s*/).map((s) => s.trim()) || []
  const colors: [string, string, string] = ['#134e4a', '#193a3a', '#1e3a8a']
  let opacity = 0.85
  parts.forEach((p, i) => {
    const rgba = p.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i)
    if (rgba) {
      const r = parseInt(rgba[1], 10)
      const g = parseInt(rgba[2], 10)
      const b = parseInt(rgba[3], 10)
      const a = rgba[4] != null ? parseFloat(rgba[4]) : 0.85
      if (i === 0) opacity = a
      const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
      if (i < 3) colors[i] = hex
    }
    const hexMatch = p.match(/#[0-9a-fA-F]{3,8}/)
    if (hexMatch && i < 3) colors[i] = hexMatch[0].length === 4 ? hexMatch[0] + hexMatch[0].slice(1) : hexMatch[0]
  })
  return { direction, colors, opacity }
}

/** Build CSS from direction + hex colors + opacity */
function buildGradientCss(direction: string, colors: [string, string, string], opacity: number): string {
  const c1 = hexToRgba(colors[0], opacity)
  const c2 = hexToRgba(colors[1], opacity * 0.9)
  const c3 = hexToRgba(colors[2], opacity)
  return `linear-gradient(${direction}, ${c1}, ${c2}, ${c3})`
}

type GradientPickerProps = {
  value: string
  onChange: (css: string) => void
}

export function GradientPicker({ value, onChange }: GradientPickerProps) {
  const parsed = useMemo(() => parseGradientCss(value), [value])
  const [direction, setDirection] = useState(parsed.direction)
  const [colors, setColors] = useState<[string, string, string]>(parsed.colors)
  const [opacity, setOpacity] = useState(parsed.opacity)
  const skipNextOnChange = useRef(false)

  useEffect(() => {
    const next = parseGradientCss(value)
    setDirection(next.direction)
    setColors(next.colors)
    setOpacity(next.opacity)
    skipNextOnChange.current = true
  }, [value])

  useEffect(() => {
    if (skipNextOnChange.current) {
      skipNextOnChange.current = false
      return
    }
    onChange(buildGradientCss(direction, colors, opacity))
  }, [direction, colors, opacity])

  const previewCss = buildGradientCss(direction, colors, opacity)

  const updateColor = (i: 0 | 1 | 2, hex: string) => {
    const next: [string, string, string] = [...colors]
    next[i] = hex.startsWith('#') ? hex : '#' + hex
    setColors(next)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 overflow-hidden h-12 w-full" style={{ background: previewCss }} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Arah gradient</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Transparansi overlay (0–100%)</Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="flex-1 h-2 rounded-full accent-teal-600"
              aria-label="Transparansi"
            />
            <span className="text-sm text-slate-600 w-10">{Math.round(opacity * 100)}%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([0, 1, 2] as const).map((i) => (
          <div key={i} className="grid gap-1.5">
            <Label>Warna {i + 1}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colors[i]?.startsWith('#') ? colors[i] : '#' + colors[i]}
                onChange={(e) => updateColor(i, e.target.value)}
                className="h-10 w-12 rounded border border-slate-200 cursor-pointer flex-shrink-0"
                aria-label={`Warna ${i + 1}`}
              />
              <Input
                value={colors[i]?.replace(/^#/, '') ?? ''}
                onChange={(e) => updateColor(i, e.target.value ? '#' + e.target.value.replace(/^#/, '') : '#000000')}
                placeholder="Hex"
                className="font-mono text-sm flex-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
