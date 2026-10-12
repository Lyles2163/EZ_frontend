<script setup lang="ts">
import { ref } from 'vue'
import { MODEL_OPTIONS, QUALITY_OPTIONS, SIZE_OPTIONS } from '../../../api/image'
import type { GenerateFormState } from '../../../composables/useImageStudio'

const form = defineModel<GenerateFormState>({ required: true })

const props = defineProps<{ submitting: boolean }>()

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'attach', files: File[]): void
  (e: 'remove-reference', id: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)
const clipboardError = ref('')

const ICONS: Record<string, string> = {
  book: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v18H6.5A2.5 2.5 0 0 1 4 19.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.6l2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"/></svg>',
  clip: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
}

const onDrop = (event: DragEvent) => {
  dropActive.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) emit('attach', files)
}

const onFilePicked = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length) emit('attach', files)
  input.value = ''
}

/** 从剪切板读取图片；浏览器未授权时降级为提示 */
const onPasteFromClipboard = async () => {
  clipboardError.value = ''
  try {
    const items = await navigator.clipboard.read()
    const files: File[] = []
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'))
      if (!type) continue
      const blob = await item.getType(type)
      files.push(new File([blob], `clipboard-${Date.now()}.${type.split('/')[1]}`, { type }))
    }
    if (files.length === 0) clipboardError.value = '剪切板中没有图片'
    else emit('attach', files)
  } catch {
    clipboardError.value = '浏览器未授权读取剪切板，请改用上传'
  }
}

const canSubmit = () => !props.submitting && form.value.prompt.trim().length > 0
</script>

<template>
  <section class="col">
    <!-- ===================== 提示词 ===================== -->
    <div class="block">
      <div class="block-head">
        <h3 class="block-title">提示词</h3>
        <div class="block-actions">
          <button class="ghost">
            <span class="i" v-html="ICONS.book" />查看提示词库
          </button>
          <button class="ghost">
            <span class="i" v-html="ICONS.folder" />查看我的资产
          </button>
        </div>
      </div>

      <textarea
          v-model="form.prompt"
          class="prompt"
          rows="7"
          placeholder="描述画面主体、风格、构图、光线和用途"
      />
    </div>

    <!-- ===================== 参考图 ===================== -->
    <div class="block">
      <div class="block-head">
        <h3 class="block-title">参考图</h3>
        <div class="block-actions">
          <button class="ghost" @click="onPasteFromClipboard">
            <span class="i" v-html="ICONS.clip" />剪切板
          </button>
          <button class="ghost" @click="fileInput?.click()">
            <span class="i" v-html="ICONS.upload" />上传
          </button>
        </div>
      </div>

      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFilePicked" />

      <div
          class="drop"
          :class="{ 'drop-tight': form.references.length > 0 }"
          :data-active="dropActive ? '' : undefined"
          @dragover.prevent="dropActive = true"
          @dragleave.prevent="dropActive = false"
          @drop.prevent="onDrop"
      >
        <p v-if="form.references.length === 0" class="drop-hint">
          暂无参考图，可将图片拖到这里
        </p>
        <div v-else class="refs">
          <div v-for="item in form.references" :key="item.id" class="ref">
            <img :src="item.url" :alt="item.name" />
            <button class="ref-x" :aria-label="`移除 ${item.name}`" @click="emit('remove-reference', item.id)">
              <span class="i" v-html="ICONS.close" />
            </button>
          </div>
        </div>
      </div>
      <p v-if="clipboardError" class="error">{{ clipboardError }}</p>
    </div>

    <!-- ===================== 模型 ===================== -->
    <div class="block">
      <h3 class="block-title">模型</h3>
      <label class="select">
        <select v-model="form.model">
          <option v-for="item in MODEL_OPTIONS" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <span class="select-icon" v-html="ICONS.chevron" />
      </label>
    </div>

    <!-- ===================== 质量 ===================== -->
    <div class="block">
      <h3 class="block-title sub">质量</h3>
      <div class="pills">
        <button
            v-for="item in QUALITY_OPTIONS"
            :key="item.value"
            class="pill"
            :data-on="form.quality === item.value ? '' : undefined"
            @click="form.quality = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <!-- ===================== 尺寸 ===================== -->
    <div class="block">
      <div class="block-head">
        <h3 class="block-title sub">尺寸</h3>
        <label class="switch">
          <span class="switch-text">16 倍数对齐</span>
          <input v-model="form.alignTo16" type="checkbox" />
          <span class="track"><span class="knob" /></span>
        </label>
      </div>
      <div class="pills">
        <button
            v-for="item in SIZE_OPTIONS"
            :key="item"
            class="pill"
            :data-on="form.size === item ? '' : undefined"
            @click="form.size = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <!-- ===================== 数量 ===================== -->
    <div class="block">
      <div class="block-head">
        <h3 class="block-title sub">数量</h3>
        <div class="stepper">
          <button class="step" :disabled="form.count <= 1" @click="form.count--">−</button>
          <span class="count">{{ form.count }}</span>
          <button class="step" :disabled="form.count >= 4" @click="form.count++">+</button>
        </div>
      </div>
    </div>

    <div class="footer">
      <button class="generate" :disabled="!canSubmit()" @click="emit('submit')">
        <span class="i" v-html="ICONS.spark" />
        {{ submitting ? '生成中…' : '开始生成' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 0;
  border-right: 1px solid var(--border);
  background: var(--main-bg);
}

.block { flex-shrink: 0; }
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.block-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.block-title.sub { font-size: 13px; }
.block-actions { display: flex; gap: 6px; }

.ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.ghost:hover { background: var(--sb-hover); }
.i { display: inline-grid; place-items: center; }
.i :deep(svg) { display: block; }

.prompt {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--glass-border-strong, var(--border));
  border-radius: 12px;
  background: var(--main-bg);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s ease;
}
.prompt:focus { border-color: var(--text); }
.prompt::placeholder { color: var(--text-muted); }

.drop {
  display: grid;
  place-items: center;
  min-height: 96px;
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--sb-bg);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.drop[data-active] {
  border-color: var(--text);
  background: var(--sb-hover);
}
.drop-tight { place-items: stretch; }
.drop-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.refs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ref {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.ref img { width: 100%; height: 100%; object-fit: cover; }
.ref-x {
  position: absolute;
  top: 2px;
  right: 2px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.error {
  margin: 6px 0 0;
  font-size: 12px;
  color: #dc2626;
}
.dark .error { color: #fca5a5; }

.select {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.select select {
  appearance: none;
  padding: 8px 34px 8px 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--main-bg);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}
.select select:focus { border-color: var(--text); }
.select-icon {
  position: absolute;
  right: 12px;
  display: inline-grid;
  place-items: center;
  color: var(--text-muted);
  pointer-events: none;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill {
  min-width: 62px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.pill:hover { background: var(--sb-hover); }
.pill[data-on] {
  border-color: var(--text);
  background: var(--main-bg);
  font-weight: 600;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.switch-text { font-size: 12px; color: var(--text-muted); }
.track {
  width: 36px;
  height: 20px;
  padding: 2px;
  border-radius: 999px;
  background: var(--sb-active);
  display: flex;
  transition: background 0.18s ease;
}
.knob {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--main-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.18s cubic-bezier(0.23, 1, 0.32, 1);
}
.switch input:checked + .track { background: var(--text); }
.switch input:checked + .track .knob { transform: translateX(16px); }
.switch input:focus-visible + .track { outline: 2px solid var(--text); outline-offset: 2px; }

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.step {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.step:hover:not(:disabled) { background: var(--sb-hover); }
.step:disabled { opacity: 0.4; cursor: not-allowed; }
.count {
  min-width: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
}

.footer {
  position: sticky;
  bottom: 0;
  padding: 14px 0 18px;
  margin-top: auto;
  background: var(--main-bg);
}
.generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--text);
  color: var(--main-bg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.generate:hover:not(:disabled) { opacity: 0.86; }
.generate:disabled { opacity: 0.4; cursor: not-allowed; }
.generate .i :deep(svg) { stroke: currentColor; }
</style>
