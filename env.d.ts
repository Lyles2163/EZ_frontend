/// <reference types="vite/client" />

// matter-js 没有自带类型声明，这里做一个宽松声明避免 vue-tsc 报错。
declare module 'matter-js' {
  namespace Matter {
    type Body = any
    type Engine = any
    type Bodies = any
    type Composite = any
  }
  const Matter: typeof Matter & { Bodies: any; Body: any; Composite: any; Engine: any }
  export default Matter
}

interface ImportMetaEnv {
  /** API 前缀，缺省 '/gw'（见 vite.config.ts 的 dev 代理） */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
