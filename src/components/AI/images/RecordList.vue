<script setup lang="ts">
import type { GenerationRecord } from '../../../api/image'
import { countImages, formatDateTime, formatDuration } from './format'

interface Props {
  records: GenerationRecord[]
  activeId: string
  checkedIds: string[]
  allChecked: boolean
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'create'): void
  (e: 'select', id: string): void
  (e: 'toggle', id: string): void
  (e: 'toggle-all'): void
  (e: 'remove'): void
}>()

const ICONS: Record<string, string> = {
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>'
}
</script>

<template>
  <aside class="col">
    <div class="head">
      <h2 class="head-title">生成记录</h2>
      <span class="head-count">{{ records.length }}</span>
    </div>

    <div class="toolbar">
      <button class="tool" @click="emit('create')">
        <span class="tool-icon" v-html="ICONS.plus" />新建
      </button>
      <button class="tool" :disabled="records.length === 0" @click="emit('toggle-all')">
        <span class="tool-icon" v-html="ICONS.check" />全选
      </button>
      <button class="tool" :disabled="checkedIds.length === 0" @click="emit('remove')">
        <span class="tool-icon" v-html="ICONS.trash" />删除
      </button>
    </div>

    <div class="list">
      <p v-if="loading" class="hint">加载中…</p>
      <p v-else-if="records.length === 0" class="hint">暂无生成记录</p>

      <article
          v-for="record in records"
          :key="record.id"
          class="card"
          :data-active="record.id === activeId ? '' : undefined"
          @click="emit('select', record.id)"
      >
        <div class="card-top">
          <input
              class="check"
              type="checkbox"
              :checked="checkedIds.includes(record.id)"
              aria-label="选择该记录"
              @click.stop
              @change="emit('toggle', record.id)"
          />
          <p class="card-title">{{ record.prompt }}</p>
          <span
              v-if="countImages(record).succeeded"
              class="tag tag-ok"
          >成功 {{ countImages(record).succeeded }}</span>
          <span
              v-if="countImages(record).failed"
              class="tag tag-bad"
          >失败 {{ countImages(record).failed }}</span>
          <span
              v-if="countImages(record).pending"
              class="tag tag-run"
          >{{ record.status === 'queued' ? '排队中' : '生成中' }}</span>
        </div>

        <div class="card-body">
          <img
              v-if="record.images[0]?.url"
              class="thumb"
              :src="record.images[0].url"
              alt=""
          />
          <div v-else class="thumb thumb-empty" />

          <div class="meta">
            <span class="chip">{{ record.images.length }} 张</span>
            <span class="chip chip-time">
              {{ record.status === 'succeeded' || record.status === 'failed'
                  ? formatDuration(record.durationMs)
                  : '进行中' }}
            </span>
          </div>
        </div>

        <p class="card-time">{{ formatDateTime(record.createdAt) }}</p>
      </article>
    </div>
  </aside>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 12px;
  border-right: 1px solid var(--border);
  background: var(--main-bg);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
}
.head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.head-count {
  min-width: 24px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--sb-active);
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.toolbar {
  display: flex;
  gap: 6px;
  padding: 0 4px 12px;
}
.tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--sb-bg);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.tool:hover:not(:disabled) { background: var(--sb-hover); }
.tool:disabled { opacity: 0.45; cursor: not-allowed; }
.tool-icon { display: inline-grid; place-items: center; }
.tool-icon :deep(svg) { display: block; }

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 8px;
}
.hint {
  margin: 24px 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.card:hover { background: var(--sb-bg); }
.card[data-active] {
  border-color: var(--text);
  background: var(--sb-bg);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: var(--text);
  cursor: pointer;
}
.card-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 11px;
}
.tag-ok { background: rgba(59, 130, 246, 0.14); color: #2563eb; }
.tag-bad { background: rgba(239, 68, 68, 0.14); color: #dc2626; }
.tag-run { background: rgba(234, 179, 8, 0.18); color: #a16207; }
.dark .tag-ok { color: #93c5fd; }
.dark .tag-bad { color: #fca5a5; }
.dark .tag-run { color: #fde047; }

.card-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.thumb {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
  background: var(--sb-bg);
}
.thumb-empty {
  border: 1px dashed var(--border);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.chip {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--sb-active);
  color: var(--text-muted);
  font-size: 11px;
}
.chip-time {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}
.dark .chip-time { color: #86efac; }

.card-time {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
