import { useEffect, useState } from 'react'

export type LookupState<T> = { status: 'idle' } | { status: 'loading' } | { status: 'done'; value: T | null }

/** Runs an async lookup for `key` (null = disabled); stale results for a previous key are ignored. */
export function useLookup<T>(key: string | null, load: (key: string) => Promise<T | null>): LookupState<T> {
  const [result, setResult] = useState<{ key: string; value: T | null } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    load(key).then(
      (value) => !cancelled && setResult({ key, value }),
      () => !cancelled && setResult({ key, value: null }),
    )
    return () => {
      cancelled = true
    }
  }, [key, load])

  if (!key) return { status: 'idle' }
  return result?.key === key ? { status: 'done', value: result.value } : { status: 'loading' }
}
