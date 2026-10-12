<script setup lang="ts">
interface Props {
  title: string
  description: string
}

defineProps<Props>()
</script>

<template>
  <section class="module">
    <h1 class="module-title">{{ title }}</h1>
    <p class="module-desc">{{ description }}</p>
    <p class="module-empty">功能开发中</p>
  </section>
</template>

<style scoped>
/* 颜色变量由 AI 壳层的 .chatgpt-shell 提供，亮暗色自动跟随 */
.module {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 24px 40px;
}

.module-title {
  margin: 0;
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.module-desc {
  margin: 0;
  max-width: 420px;
  font-size: 14px;
  text-align: center;
  color: var(--text-muted);
}

.module-empty {
  margin: 8px 0 0;
  padding: 9px 16px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--sb-bg);
  font-size: 13px;
  color: var(--text-muted);
}
</style>
