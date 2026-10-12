<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { GenerationRecord } from '../../../api/image'
import { formatDateTime } from './format'

interface Props {
  record: GenerationRecord | null
}

const props = defineProps<Props>()

const preview = ref<string | null>(null)

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') preview.value = null
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="col">
    <div v-if="props.record" class="head">
      <div class="head-text">
        <p class="head-prompt">{{ props.record.prompt }}</p>
        <p class="head-meta">
          {{ props.record.model }} · {{ props.record.size }} ·
          {{ formatDateTime(props.record.createdAt) }}
        </p>
      </div>
    </div>

    <div v-if="!props.record || props.record.images.length === 0" class="empty">
      <span class="empty-icon">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor"
             stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2.5"/>
          <circle cx="9" cy="9" r="1.8"/>
          <path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/>
          <path d="M17 3.5v3M15.5 5h3"/>
        </svg>
      </span>
      <span class="empty-box">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor"
             stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5Z"/>
          <path d="M3 8.5 12 13l9-4.5"/>
        </svg>
      </span>
      <p class="empty-text">还没有生成图片</p>
    </div>

    <div v-else class="grid">
      <figure v-for="image in props.record.images" :key="image.id" class="cell">
        <button
            v-if="image.status === 'succeeded'"
            class="shot"
            @click="preview = image.url"
        >
          <img :src="image.url" :alt="image.id" />
        </button>

        <div v-else-if="image.status === 'pending'" class="shot pending">
          <span class="spinner" />
          <p class="pending-text">生成中…</p>
        </div>

        <div v-else class="shot failed">
          <p class="failed-text">{{ image.errorMessage ?? '生成失败' }}</p>
        </div>
      </figure>
    </div>

    <div
        v-if="preview"
        class="mask"
        role="dialog"
        aria-label="图片预览"
        @click="preview = null"
    >
      <img class="full" :src="preview" alt="" @click.stop />
    </div>
  </section>
</template>

<style scoped>
.col {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
  background: var(--main-bg);
}

.head {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.head-prompt {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  word-break: break-word;
}
.head-meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 320px;
  border: 1px dashed var(--border);
  border-radius: 16px;
  color: var(--text-muted);
}
.empty-icon { display: block; }
.empty-box { display: block; opacity: 0.7; }
.empty-text { margin: 0; font-size: 13px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.cell { margin: 0; }
.shot {
  display: grid;
  place-items: center;
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--sb-bg);
  overflow: hidden;
  cursor: zoom-in;
}
.shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s cubic-bezier(0.23, 1, 0.32, 1);
}
.shot:hover img { transform: scale(1.03); }

.pending { cursor: default; }
.spinner {
  width: 26px;
  height: 26px;
  border: 2px solid var(--border);
  border-top-color: var(--text);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pending-text {
  position: absolute;
  margin: 48px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.failed {
  cursor: default;
  border-color: rgba(239, 68, 68, 0.5);
}
.failed-text {
  margin: 0;
  padding: 0 14px;
  font-size: 12px;
  color: #dc2626;
  text-align: center;
}
.dark .failed-text { color: #fca5a5; }

.mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.72);
  cursor: zoom-out;
}
.full {
  max-width: min(1100px, 100%);
  max-height: 100%;
  border-radius: 12px;
  cursor: default;
}
</style>
