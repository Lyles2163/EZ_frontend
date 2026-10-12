<script setup lang="ts">
import { ref, computed } from 'vue'
import PromptBar from '../../components/AI/PromptBar.vue'
import SpecularButton from '../../components/button/SpecularButton.vue'
import type { PromptBarSendDetail } from '../../components/AI/PromptBar.vue'
import { useTheme } from '../../composables/useTheme'

// ================= 状态 =================
const busy = ref(false)
const collapsed = ref(false)
const activeKey = ref('new')

// ================= 侧边栏导航 =================
type NavItem = {
  key: string
  label: string
  icon: string
  external?: boolean
}

// ================= 主题 =================
const theme = useTheme()

const ICONS: Record<string, string> = {
  plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/></svg>',
  plug: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>',
  flask: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v6.5"/><path d="M14 8.5V2"/><path d="M8.5 2h7"/><path d="M14 8.5a6.5 6.5 0 1 1-4 0"/><path d="M5.5 16h13"/></svg>',
  circle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  help: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.7 1c0 2-3 2.5-3 4"/><path d="M12 17h.01"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  panel: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  external: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
}

const navItems: NavItem[] = [
  { key: 'new',      label: 'New chat',              icon: 'plus'   },
  { key: 'images',   label: 'Images',                icon: 'image'  },
  { key: 'plugins',  label: 'Plugins',               icon: 'plug'   },
  { key: 'research', label: 'Deep research',         icon: 'flask'  },
  { key: 'plans',    label: 'See plans and pricing', icon: 'circle', external: true },
  { key: 'help',     label: 'Help',                  icon: 'help',   external: true },
  { key: 'settings', label: 'Settings',              icon: 'gear'   }
]

const handleNav = (item: NavItem) => {
  activeKey.value = item.key
  if (item.external) {
    console.log('open external:', item.key)
  }
}

// ================= 登录按钮主题色 =================
const loginSpecular = computed(() => {
  if (theme.value === 'light') {
    return {
      tint: '#ffffff',
      textColor: '#ffffff',
      lineColor: '#ffffff',
      baseColor: '#18181b',
      backgroundColor: '#18181b',
    }
  }
  return {
    tint: '#ffffff',
    textColor: '#09090b',
    lineColor: '#18181b',
    baseColor: '#fafafa',
    backgroundColor: '#fafafa',
  }
})

// ================= PromptBar 主题色 =================
const promptColors = computed(() => {
  if (theme.value === 'light') {
    return {
      background: '#ffffff',
      color: '#0d0d0d',
      menuBackground: '#ffffff',
      sparkColor: '#8ab4ff',
    }
  }
  return {
    background: '#2a2a2a',
    color: '#ececec',
    menuBackground: '#2a2a2a',
    sparkColor: '#6ea8ff',
  }
})

// ================= PromptBar 回调 =================
const send = async (text: string, detail: PromptBarSendDetail) => {
  busy.value = true
  try {
    console.log('send:', text, detail)
    await new Promise(r => setTimeout(r, 800))
  } finally {
    busy.value = false
  }
}

const stop = () => {
  busy.value = false
}

const attach = (): string[] => {
  return []
}

const dictate = (): string => {
  return ''
}

const onEffortChange = (effort: string) => {
  console.log('effort:', effort)
}
</script>

<template>
  <div
      class="chatgpt-shell"
      :class="{ collapsed, dark: theme === 'dark' }"
  >
    <!-- ===================== 侧边栏 ===================== -->
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="brand-row">
          <span class="brand">EZ-AI</span>
          <button class="icon-btn" aria-label="Toggle sidebar" @click="collapsed = !collapsed">
            <span v-html="ICONS.panel" />
          </button>
        </div>

        <nav class="nav">
          <button
              v-for="item in navItems"
              :key="item.key"
              class="nav-item"
              :data-active="activeKey === item.key ? '' : undefined"
              :title="collapsed ? item.label : undefined"
              @click="handleNav(item)"
          >
            <span class="nav-icon" v-html="ICONS[item.icon]" />
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
            <span
                v-if="item.external && !collapsed"
                class="nav-ext"
                v-html="ICONS.external"
            />
          </button>
        </nav>
      </div>

      <div v-if="!collapsed" class="sidebar-bottom">
        <p class="cta-title">Get responses tailored to you</p>
        <p class="cta-body">
          Log in to get answers based on saved chats, plus create images and upload files.
        </p>

        <SpecularButton
            size="lg"
            :radius="999"
            :tint="loginSpecular.tint"
            :tint-opacity="1"
            :blur="3"
            :text-color="loginSpecular.textColor"
            :line-color="loginSpecular.lineColor"
            :base-color="loginSpecular.baseColor"
            :intensity="1"
            :shine-size="12"
            :shine-fade="40"
            :thickness="1"
            :speed="0.35"
            follow-mouse
            :proximity="250"
            :auto-animate="false"
            :background-color="loginSpecular.backgroundColor"
        >
          Log in
        </SpecularButton>
      </div>
    </aside>

    <!-- ===================== 主区域 ===================== -->
    <main class="main">
      <header class="topbar">
      </header>

      <section class="chat-area">
        <h1 class="greeting">Where should<br />we begin?</h1>

        <div class="prompt-wrap">
          <PromptBar
              placeholder="问点什么"
              :busy="busy"
              :onAttach="attach"
              :onDictate="dictate"
              :background="promptColors.background"
              :color="promptColors.color"
              :menuBackground="promptColors.menuBackground"
              :sparkColor="promptColors.sparkColor"
              :sparkBoost="1"
              :width="680"
              :radius="26"
              :maxRows="5"
              :morphDuration="240"
              :squash="0.12"
              :tilt="8"
              :pressScale="0.96"
              @send="send"
              @stop="stop"
              @effortChange="onEffortChange"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* ===================== 主题变量（亮） ===================== */
.chatgpt-shell {
  --sb-bg: #f9f9f9;
  --sb-hover: #ececec;
  --sb-active: #e5e5e5;
  --main-bg: #ffffff;
  --text: #0d0d0d;
  --text-muted: #5d5d5d;
  --border: rgba(0, 0, 0, 0.08);

  position: fixed;
  inset: 0;
  /* 悬浮 Header 的净空：只让内容避开，背景/侧边栏铺满整屏 */
  --head-clear: 96px;
  display: flex;
  background: var(--main-bg);
  color: var(--text);
  font-size: 14px;
  transition: background 0.3s ease, color 0.3s ease;
}

/* ===================== 暗色主题 ===================== */
.chatgpt-shell.dark {
  --sb-bg: #171717;
  --sb-hover: #242424;
  --sb-active: #2f2f2f;
  --main-bg: #212121;
  --text: #ececec;
  --text-muted: #a0a0a0;
  --border: rgba(255, 255, 255, 0.08);
}

/* ===================== 侧边栏 ===================== */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 8px;
  background: var(--sb-bg);
  border-right: 1px solid var(--border);
  transition: width 0.22s cubic-bezier(0.23, 1, 0.32, 1);
  overflow: hidden;
}
.chatgpt-shell.collapsed .sidebar {
  width: 56px;
}
/* 收起时品牌文字会把开关挤出 overflow 裁剪区，导致点不到 */
.chatgpt-shell.collapsed .brand {
  display: none;
}
.chatgpt-shell.collapsed .brand-row {
  justify-content: center;
  padding: 4px 0 8px;
}
/* 悬浮 Header 居中、最宽 900px：视口窄于 900/2 + 260 = 1420px 时它会压到侧边栏顶部，此时才让开 */
@media (max-width: 1419px) {
  .sidebar {
    padding-top: var(--head-clear);
  }
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 8px 10px;
  height: 44px;
}
.brand {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease;
}
.icon-btn:hover { background: var(--sb-hover); }

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: background 0.15s ease;
}
.nav-item:hover { background: var(--sb-hover); }
.nav-item[data-active] { background: var(--sb-active); }

.nav-icon {
  display: inline-grid;
  place-items: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  color: var(--text);
}
.nav-icon :deep(svg) { display: block; }

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-ext {
  display: inline-grid;
  place-items: center;
  color: var(--text-muted);
}
.nav-ext :deep(svg) { display: block; }

/* ===================== 侧边栏底部 ===================== */
.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 6px 6px;
  border-top: 1px solid var(--border);
}
.cta-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.cta-body {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}

/* ===================== 主区域 ===================== */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: var(--head-clear);
  background: var(--main-bg);
}

.topbar {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  height: 52px;
}
.model-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.model-picker:hover { background: var(--sb-hover); }
.chev { display: inline-grid; place-items: center; color: var(--text-muted); }
.chev :deep(svg) { display: block; }

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 24px 40px;
  min-height: 0;
}

.greeting {
  margin: 0;
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-align: center;
}

/* 关键：不要给 height，让 PromptBar 自己撑开 */
.prompt-wrap {
  width: 100%;
  max-width: 680px;
}

/* ===================== 小屏 ===================== */
@media (max-width: 767px) {
  .chatgpt-shell {
    --head-clear: 80px;
  }

  .sidebar { width: 56px; }
  .sidebar .brand,
  .sidebar .nav-label,
  .sidebar .nav-ext,
  .sidebar .sidebar-bottom { display: none; }

  .chat-area {
    justify-content: flex-start;
    padding: 48px 16px 24px;
    gap: 20px;
  }

  .greeting {
    font-size: 24px;
  }
}
</style>