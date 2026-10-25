<script setup lang="ts">
import type { Conversation } from '../../api/chat'

defineProps<{
  items: Conversation[]
  activeId: number | null
  hasMore: boolean
}>()

const emit = defineEmits<{
  select: [id: number]
  create: []
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
  <aside class="conv">
    <button class="conv-new" @click="emit('create')">＋ 新对话</button>

    <ul class="conv-list">
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
  </aside>
</template>

<style scoped>
/* 显隐由父级 Chat.vue 的 v-if 控制：这个组件不掺和断点，也不写 display:none */
.conv {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 232px;
  flex: 0 0 232px;
  padding: 12px 8px;
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.conv-new {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.conv-new:hover { background: var(--sb-hover); }
.conv-list {
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
  padding: 8px 10px;
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
  font-size: 12px;
  color: var(--text-muted);
}
.conv-more {
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
}
.conv-empty {
  margin: 8px 4px;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
