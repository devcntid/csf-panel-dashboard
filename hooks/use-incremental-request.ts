'use client'

import { useCallback, useRef } from 'react'

/**
 * Menandai permintaan async yang sudah "kadaluarsa" setelah dependency effect berubah
 * atau komponen unmount, agar setState tidak memicu update setelah navigasi.
 */
export function useIncrementalRequest() {
  const gen = useRef(0)

  const start = useCallback(() => {
    const id = ++gen.current
    return () => id !== gen.current
  }, [])

  const invalidate = useCallback(() => {
    gen.current++
  }, [])

  return { start, invalidate }
}
