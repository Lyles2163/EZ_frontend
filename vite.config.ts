import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(), tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 网关没有任何 CORS 配置，浏览器直连 8100 必被同源策略拦掉，所以走 dev 代理。
      // 前缀必须是 /gw 而非 /user、/ai —— 那两个同时也是前端路由，代理会吃掉页面导航。
      '/gw': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gw/, ''),
      },
    },
  },
})
