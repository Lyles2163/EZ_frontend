<script setup lang="ts">
import type { Conversation } from '../../api/chat'

defineProps<{
  items: Conversation[]
  activeId: number | null
  hasMore: boolean
}>()

const emit = defineEmits<{
  select: [id: number]
  more: []
}>()

const fmtTime = (ms: number): string => {
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
</script>

<template>
  <!-- 挂在 Layout 的侧边栏里，所以宽度、显隐、收起都归父级：这里只做一列能滚的列表 -->
  <div class="convs">
    <p class="convs-label">对话</p>

    <ul class="convs-list">
      <li v-for="item in items" :key="item.id">
        <button
            class="conv-item"
            :data-active="item.id === activeId ? '' : undefined"
            @click="emit('select', item.id)"
        >
          <span class="conv-title">{{ item.title }}</span>
          <span class="conv-meta">
            {{ item.effort }} · {{ item.modelKey }} · {{ fmtTime(item.updateTime) }}
          </span>
        </button>
      </li>
    </ul>

    <button v-if="hasMore" class="conv-more" @click="emit('more')">加载更多</button>
    <p v-if="!items.length" class="conv-empty">还没有对话</p>
  </div>
</template>

<style scoped>
.convs {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.convs-label {
  margin: 0 0 2px;
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.convs-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.conv-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.conv-item:hover { background: var(--sb-hover); }
.conv-item[data-active] { background: var(--sb-active); }
.conv-title {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 500;
}
.conv-meta {
  font-size: 11px;
  color: var(--text-muted);
}
.conv-more {
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.conv-more:hover { background: var(--sb-hover); }
.conv-empty {
  margin: 4px 10px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
