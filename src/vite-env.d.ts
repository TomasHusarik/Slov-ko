/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional base URL of a remote vocabulary API; the curated dataset is used as fallback. */
  readonly VITE_VOCAB_API_URL?: string
}
