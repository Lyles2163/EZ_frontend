<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AeroShards from '../components/background/AeroShards.vue'
import { useTheme } from '../composables/useTheme'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const theme = useTheme()
const auth = useAuthStore()

// AeroShards 默认是深紫皮肤，这里按当前主题把三组色值当 props 传进去，组件内部零改动。
// 亮色走「纸上石墨」的中性灰，组件会按 backgroundLuma 自行降曝光，浅底是它支持的路径。
// scrim 是下半屏的压暗渐变，保证往后加的章节始终有对比度。
const palette = computed(() =>
  theme.value === 'dark'
    ? { background: '#120F17', shard: '#896ABD', accent: '#A855F7', scrim: 'rgba(9, 9, 11, 0.72)' }
    : { background: '#f4f4f5', shard: '#71717a', accent: '#18181b', scrim: 'rgba(244, 244, 245, 0.78)' },
)

const pageStyle = computed(() => ({ '--home-scrim': palette.value.scrim }))
</script>

<template>
  <div class="home-page" :style="pageStyle">
    <div class="home-bg">
      <AeroShards
          :background-color="palette.background"
          :shard-color="palette.shard"
          :accent-color="palette.accent"
          placement="full"
      />
    </div>

    <div class="home-scrim" aria-hidden="true" />

    <div class="home-content">
      <section class="hero">
        <h1 class="hero-title">EZ-Up</h1>
        <p class="hero-sub">刷题 · AI · 圈子</p>
        <div class="hero-actions">
          <button class="btn btn-primary" @click="router.push('/practice')">开始刷题</button>
          <button
              class="btn btn-ghost"
              @click="router.push(auth.isLoggedIn ? '/user' : '/login')"
          >
            {{ auth.isLoggedIn ? auth.userName : '登录' }}
          </button>
        </div>
      </section>

      <section class="slot">
        <p class="slot-note">后续内容待填充</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* position: relative 不会成为 fixed 后代的包含块，所以 .home-bg 仍然贴着视口 */
.home-page {
  position: relative;
}

/* AeroShards 根节点是 w-full h-full，需要这一层给它确定的视口尺寸 */
.home-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.home-scrim {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent 35%, var(--home-scrim) 100%);
}

.home-content {
  position: relative;
  z-index: 1;
}

.hero {
  min-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 20px;
  text-align: center;
}

.hero-title {
  margin: 0;
  font-size: clamp(44px, 12vw, 92px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.hero-sub {
  margin: 0;
  font-size: clamp(13px, 2.4vw, 16px);
  letter-spacing: 0.2em;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}

.btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 11px 24px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: var(--primary-500);
  color: var(--primary-contrast);
}

.btn-ghost {
  background: var(--glass-bg);
  color: var(--text-primary);
  border-color: var(--glass-border-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.slot {
  min-height: 70vh;
  display: grid;
  place-items: center;
  padding: 40px 20px;
}

.slot-note {
  margin: 0;
  padding: 18px 26px;
  border: 1px dashed var(--glass-border-strong);
  border-radius: 14px;
  font-size: 13px;
  color: var(--text-muted);
}

@media (max-width: 767px) {
  .hero {
    min-height: calc(100vh - 80px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
}
</style>
