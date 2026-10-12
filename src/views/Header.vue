<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import JellyRadio, { type JellyRadioItem } from '../components/JellyRadio.vue'
import SpecularButton from '../components/button/SpecularButton.vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  (e: 'toggle-theme'): void
}>()

const router = useRouter()
const route = useRoute()

type NavItem = Extract<JellyRadioItem, { value: string }>

const navigationItems: NavItem[] = [
  { value: '/', label: '首页' },
  { value: '/user', label: '用户' },
  { value: '/practice', label: '刷题' },
  { value: '/ai', label: 'AI' },
  { value: '/community', label: '圈子' },
]

const activePath = computed(() =>
    navigationItems.find(item => route.path === item.value || route.path.startsWith(`${item.value}/`))?.value
        ?? '/practice'
)

const navigateTo = (path: string) => {
  if (path !== route.path) router.push(path)
}

const auth = useAuthStore()

const goLogin = () => {
  if (route.path !== '/login') router.push('/login')
}

const signOut = async () => {
  await auth.logout()
  // 必须自己走：logout 只清态，守卫不会替已登录页面兜回来，
  // 否则用户会停在 /ai 这类受保护页上却没有会话。
  if (route.path !== '/login') router.replace('/login')
}

// ========== SpecularButton 黑白主题配色 ==========
const specularProps = computed(() => {
  if (props.theme === 'light') {
    // 亮色主题：黑底白字，高光用白色
    return {
      tint: '#000000',       // 镜面高光色
      textColor: '#ffffff',  // 按钮文字
      lineColor: '#ffffff',  // 高光描边
      baseColor: '#18181b',  // 底色
      backgroundColor: '#18181b', // 按钮背景
    }
  } else {
    // 暗色主题：白底黑字，高光用近黑
    return {
      tint: '#ffffff',
      textColor: '#09090b',
      lineColor: '#18181b',
      baseColor: '#fafafa',
      backgroundColor: '#fafafa',
    }
  }
})
</script>

<template>
  <header class="app-header glass">
    <div class="header-container">
      <div class="logo">EZ-Up</div>

      <div class="nav-wrapper">
        <JellyRadio
            :items="navigationItems"
            :value="activePath"
            aria-label="主导航"
            size="md"
            :gap="8"
            :radius="10"
            chip-color="transparent"
            active-color="var(--primary-500)"
            text-color="var(--text-primary)"
            active-text-color="var(--primary-contrast)"
            :swell="0.2"
            :barge="4"
            :jelly="1"
            @change="navigateTo"
        />
      </div>

      <div class="actions">
        <button class="icon-btn glass-lite" aria-label="全屏">⛶</button>

        <button
            class="icon-btn glass-lite"
            @click="emit('toggle-theme')"
            :aria-label="theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'"
        >
          <!-- 亮色下显示月亮（点击切到暗色），暗色下显示太阳 -->
          <svg
              v-if="theme === 'light'"
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
          <svg
              v-else
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </button>

        <template v-if="auth.isLoggedIn">
          <div class="user-chip glass-lite" :title="auth.userName">
            <span class="user-avatar" aria-hidden="true">{{ auth.userName.slice(0, 1).toUpperCase() }}</span>
            <span class="user-name">{{ auth.userName }}</span>
          </div>
          <button class="icon-btn glass-lite" aria-label="退出登录" @click="signOut">
            <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </template>

        <!-- sm ≈ 34px 高，和旁边的 .icon-btn 等高；lg/md 会顶满 60px 的 header -->
        <SpecularButton
            v-else
            size="sm"
            :radius="40"
            :tint="specularProps.tint"
            :tint-opacity="1"
            :blur="3"
            :text-color="specularProps.textColor"
            :line-color="specularProps.lineColor"
            :base-color="specularProps.baseColor"
            :intensity="1"
            :shine-size="12"
            :shine-fade="40"
            :thickness="1"
            :speed="0.35"
            follow-mouse
            :proximity="250"
            :auto-animate="false"
            :background-color="specularProps.backgroundColor"
            @click="goLogin"
        >
          登录
        </SpecularButton>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 900px;
  height: 60px;
  border-radius: 999px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-container {
  width: 100%;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.logo {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  padding-left: 8px;
}

.nav-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-wrapper::-webkit-scrollbar { display: none; }

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  outline: none;
  border: none;
  color: var(--text-primary);
  background: transparent;
  transition: all 0.2s ease;
}
.icon-btn:hover {
  background: var(--glass-bg-hover);
  transform: scale(1.05);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--glass-border-strong);
  outline-offset: 2px;
}
.icon-btn .icon {
  width: 16px;
  height: 16px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px 0 4px;
  border-radius: 999px;
  color: var(--text-primary);
}

.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--primary-500);
  color: var(--primary-contrast);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

@media (max-width: 767px) {
  .user-name {
    display: none;
  }
  .user-chip {
    padding: 0 4px;
  }
}

@media (max-width: 767px) {
  .app-header {
    top: 12px;
    width: 95%;
    height: 54px;
  }
  .logo { display: none; }
}
</style>