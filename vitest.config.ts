import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// node 环境就够：本仓库只测纯逻辑，DOM 组件一律靠浏览器实跑验收（裁定二）。
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // 只收 .spec.ts：既有 3 个 *.test.ts 是 node:test 写的（实测 node --test 直接跑绿），
    // vitest 收到它们会因为找不到 vitest 的 suite 而报错。
    include: ['src/**/*.spec.ts'],
    // request.ts 的 BASE_URL 在模块加载时读 import.meta.env.VITE_API_BASE。
    // 真实 dev 走 vite 代理的 /gw，测试必须和它同一条 URL，否则断言会在另一条链路上绿。
    env: { VITE_API_BASE: '' },
  },
})
