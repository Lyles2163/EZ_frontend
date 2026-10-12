/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 前缀，缺省 '/gw'（见 vite.config.ts 的 dev 代理） */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
