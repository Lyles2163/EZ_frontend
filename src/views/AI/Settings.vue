<script setup lang="ts">
import { useTheme } from '../../composables/useTheme'

const theme = useTheme()
</script>

<template>
  <section class="page">
    <header class="page-head">
      <h2 class="page-title">Settings</h2>
      <p class="page-desc">AI 模块相关设置。</p>
    </header>

    <div class="group">
      <p class="group-title">外观</p>
      <div class="row">
        <div class="row-text">
          <p class="row-name">当前主题</p>
          <p class="row-desc">在顶部导航栏切换亮色 / 暗色模式。</p>
        </div>
        <span class="badge">{{ theme === 'dark' ? '暗色' : '亮色' }}</span>
      </div>
    </div>

    <div class="group">
      <p class="group-title">会话</p>
      <div class="row">
        <div class="row-text">
          <p class="row-name">模型偏好</p>
          <p class="row-desc">默认回答风格与推理深度，开发中。</p>
        </div>
      </div>
      <div class="row">
        <div class="row-text">
          <p class="row-name">历史记录</p>
          <p class="row-desc">登录后可保存会话记录，开发中。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px 40px;
}
.page-head {
  max-width: 900px;
  margin: 0 auto 24px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.group {
  max-width: 900px;
  margin: 0 auto 22px;
}
.group-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--sb-bg);
}
.row + .row { margin-top: 8px; }
.row-text { flex: 1; min-width: 0; }
.row-name {
  margin: 0 0 3px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.row-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--sb-active);
  color: var(--text);
  font-size: 12px;
}
</style>
