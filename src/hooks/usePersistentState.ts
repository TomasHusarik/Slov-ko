import { useEffect, useState } from 'react'
import { readStored, writeStored } from '../utils/storage'

export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    readStored(key, typeof initial === 'function' ? (initial as () => T)() : initial),
  )

  useEffect(() => {
    writeStored(key, value)
  }, [key, value])

  return [value, setValue] as const
}
