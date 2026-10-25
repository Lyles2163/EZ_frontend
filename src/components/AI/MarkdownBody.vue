<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { onBeforeUnmount, ref, watch } from 'vue'
import { closeOpenFence, decorateLinks } from './streamMarkdown'

const props = defineProps<{ source: string; done?: boolean }>()

const html = ref('')
let frame = 0

marked.setOptions({ gfm: true, breaks: false })

/** 模型输出是不可信内容：每一次更新都重新过 DOMPurify，不是只做首次。 */
const render = (): void => {
  const raw = props.done ? props.source : closeOpenFence(props.source)
  const unsafe = marked.parse(raw, { async: false })
  html.value = decorateLinks(
    DOMPurify.sanitize(unsafe, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'script'],
      FORBID_ATTR: ['style']
    })
  )
}

/** delta 只累积字符串，渲染用 rAF 合并：每帧重解析是 O(n²)，长回答会把浏览器钉住。 */
const schedule = (): void => {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    render()
  })
}

watch(() => props.source, schedule)
watch(
  () => props.done,
  () => {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    render()
  }
)
render()

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <!-- v-html 是本段唯一允许的一处：上面已过 DOMPurify -->
  <div class="md" v-html="html" />
</template>

<style scoped>
.md {
  font-size: 15px;
  line-height: 1.65;
  color: var(--text);
  overflow-wrap: anywhere;
}
.md :deep(pre) {
  overflow-x: auto;
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.92em;
}
.md :deep(a) {
  color: inherit;
  text-decoration: underline;
}
.md :deep(table) {
  border-collapse: collapse;
}
.md :deep(th),
.md :deep(td) {
  padding: 4px 10px;
  border: 1px solid var(--border);
}
.md :deep(> :first-child) {
  margin-top: 0;
}
.md :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
