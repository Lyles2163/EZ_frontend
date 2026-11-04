import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

import { petServer, readPetRuntime, resolvePetPort } from './vite-plugins/petServer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(), tailwindcss(), petServer()
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
      // dsh-pet 独立模式：/pet -> http://127.0.0.1:<端口>
      // iframe 渲染页 + HTTP API 控制都走这条，避免浏览器跨域。
      // 进程由 petServer() 插件随 dev server 起停，这里只负责转发。
      '/pet': {
        target: `http://127.0.0.1:${resolvePetPort()}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pet/, ''),
        // 写操作要 x-dsh-pet-token 鉴权。令牌每次桌宠启动都会换，所以必须在每个请求上
        // 现读运行清单，不能在启动时读死——否则桌宠一重启，前端这边就全程 403，
        // 只能连带重启 dev server。
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = readPetRuntime()?.token
            if (token) proxyReq.setHeader('x-dsh-pet-token', token)
          })
        },
      },
    },
  },
})
