/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
  readonly VITE_TWELVEDATA_API_KEY?: string
  readonly VITE_TWELVEDATA_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_DEBUG_PWA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
