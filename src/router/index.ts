import { createRouter, createWebHistory } from 'vue-router'
import { setUnauthorizedHandler } from '../api/request'
import { resolveRedirect, useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { title: '首页' }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/user',
      name: 'user',
      component: () => import('../views/User/Index.vue'),
      meta: { title: '用户模块', requiresAuth: true }
    },
    {
      path: '/practice',
      name: 'practice',
      component: () => import('../views/Practice/Index.vue'),
      meta: { title: '刷题模块' }
    },
    {
      path: '/ai',
      component: () => import('../views/AI/Layout.vue'),
      meta: { title: 'AI模块', requiresAuth: true },
      children: [
        { path: '', name: 'ai-chat', component: () => import('../views/AI/Chat.vue') },
        { path: 'images', name: 'ai-images', component: () => import('../views/AI/Images.vue') },
        { path: 'plugins', name: 'ai-plugins', component: () => import('../views/AI/Plugins.vue') },
        { path: 'rag', name: 'ai-rag', component: () => import('../views/AI/Rag.vue') },
        { path: 'settings', name: 'ai-settings', component: () => import('../views/AI/Settings.vue') }
      ]
    },
    {
      path: '/community',
      name: 'community',
      component: () => import('../views/Community/Index.vue'),
      meta: { title: '圈子模块' }
    }
  ]
})

// 必须在回调体内取 store：main.ts 先 import 本文件、后才 app.use(createPinia())
router.beforeEach((to) => {
  const auth = useAuthStore()
  const needsAuth = to.matched.some(record => record.meta.requiresAuth)

  if (needsAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return { path: resolveRedirect(to.query.redirect) }
  }
})

// 401/403 统一收口。放在这里而不是 store：store import router 会和 router import store 成环。
setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  if (!auth.token) return
  const from = router.currentRoute.value.fullPath
  auth.clear()
  if (router.currentRoute.value.path !== '/login') {
    void router.replace({ path: '/login', query: { redirect: from } })
  }
})

export default router
