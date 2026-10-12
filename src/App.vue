<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from './views/Header.vue'

// ========== 主题切换逻辑 ==========
type Theme = 'light' | 'dark'
const THEME_KEY = 'app-theme'

/** 初始化时同步读取，避免 onMounted 之后再改主题导致的闪烁 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<Theme>(getInitialTheme())

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

watch(
    theme,
    (val) => {
      document.documentElement.setAttribute('data-theme', val)
      localStorage.setItem(THEME_KEY, val)
    },
    { immediate: true },
)

onMounted(() => {
  // 用户没手动选过时，跟随系统切换
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      theme.value = e.matches ? 'dark' : 'light'
    }
  })
})
</script>

<template>
  <div class="app-shell">
    <AppHeader :theme="theme" @toggle-theme="toggleTheme" />

    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<!-- ================= 全局样式 ================= -->
<style>
/* ==========================================================
   1. 设计令牌 —— 黑白灰
   ========================================================== */
:root {
  color-scheme: light;

  /* 背景 */
  --bg-base: #f4f4f5;
  --bg-elevated: #ffffff;

  /* 背景光晕 */
  --glow-1: rgba(255, 255, 255, 0.95);
  --glow-2: rgba(228, 228, 231, 0.75);
  --glow-3: rgba(250, 250, 250, 0.90);

  /* 毛玻璃 */
  --glass-bg: rgba(255, 255, 255, 0.60);
  --glass-bg-hover: rgba(255, 255, 255, 0.82);
  --glass-border: rgba(0, 0, 0, 0.07);
  --glass-border-strong: rgba(0, 0, 0, 0.16);
  --glass-highlight: rgba(255, 255, 255, 0.95); /* 顶部内高光 */
  --glass-shadow: rgba(0, 0, 0, 0.06);
  --glass-blur: 24px;
  --glass-saturate: 160%;

  /* 主色：黑 */
  --primary-500: #18181b;
  --primary-600: #000000;
  --primary-contrast: #ffffff;

  /* 文字 */
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-muted: #a1a1aa;

  --divider: rgba(0, 0, 0, 0.08);
}

[data-theme='dark'] {
  color-scheme: dark;

  --bg-base: #09090b;
  --bg-elevated: #18181b;

  --glow-1: rgba(63, 63, 70, 0.45);
  --glow-2: rgba(39, 39, 42, 0.60);
  --glow-3: rgba(24, 24, 27, 0.80);

  --glass-bg: rgba(255, 255, 255, 0.06);
  --glass-bg-hover: rgba(255, 255, 255, 0.11);
  --glass-border: rgba(255, 255, 255, 0.10);
  --glass-border-strong: rgba(255, 255, 255, 0.26);
  --glass-highlight: rgba(255, 255, 255, 0.10);
  --glass-shadow: rgba(0, 0, 0, 0.55);
  --glass-blur: 24px;
  --glass-saturate: 160%;

  /* 主色：白 */
  --primary-500: #fafafa;
  --primary-600: #ffffff;
  --primary-contrast: #09090b;

  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  --divider: rgba(255, 255, 255, 0.08);
}

/* ==========================================================
   2. 全局基础
   ========================================================== */
html,
body {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background-color: var(--bg-base);
  background-image:
      radial-gradient(circle at 12% 8%, var(--glow-1) 0%, transparent 45%),
      radial-gradient(circle at 88% 12%, var(--glow-2) 0%, transparent 45%),
      radial-gradient(circle at 50% 88%, var(--glow-3) 0%, transparent 55%);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  /* 只过渡颜色，绝不过渡 backdrop-filter */
  transition: background-color 0.35s ease, color 0.35s ease;
}

/* ==========================================================
   3. 毛玻璃
   ========================================================== */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow:
      0 16px 40px var(--glass-shadow),
      inset 0 1px 0 var(--glass-highlight);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.glass:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
}

/* 轻量档：列表项、小按钮等大量重复元素 */
.glass-lite {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  transition: background 0.3s ease, border-color 0.3s ease;
}

@supports not (backdrop-filter: blur(1px)) {
  .glass,
  .glass-lite {
    background: var(--bg-elevated);
    opacity: 0.95;
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass,
  .glass-lite {
    transition: none;
  }
}

/* ==========================================================
   4. 页面切换动画
   ========================================================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ==========================================================
   5. 布局骨架
   ========================================================== */
.app-shell {
  width: 100%;
  min-height: 100vh;
}

.main-content {
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  padding-top: 96px; /* 让开 fixed Header：top24 + 高60 + 间距 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

.main-content > * {
  width: 100%;
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

/* ==========================================================
   6. 响应式：玻璃强度 + 布局
   ========================================================== */

/* 平板：降低模糊半径，省 GPU */
@media (max-width: 1023px) {
  :root,
  [data-theme='dark'] {
    --glass-blur: 18px;
  }
  .main-content {
    padding-top: 88px;
  }
}

/* 手机 */
@media (max-width: 767px) {
  :root,
  [data-theme='dark'] {
    --glass-blur: 12px;
  }
  .main-content {
    padding-top: 80px;
  }
}
</style>