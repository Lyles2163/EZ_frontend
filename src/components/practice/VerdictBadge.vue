<!-- src/components/practice/VerdictBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { OJ_STATUS_TEXT, OJ_STATUS_TONE } from '../../api/practice/oj'

const props = defineProps<{ status: string }>()

const text = computed(() => OJ_STATUS_TEXT[props.status] ?? props.status)
const tone = computed(() => OJ_STATUS_TONE[props.status] ?? 'idle')
</script>

<template>
  <span class="vb" :class="`vb--${tone}`">{{ text }}</span>
</template>

<style scoped>
.vb {
  display: inline-flex; align-items: center;
  padding: 2px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; line-height: 1.8;
  border: 1px solid transparent;
}
/* 四态色来自 Practice/Layout.vue 定义的模块内变量，不在这里硬编码十六进制 */
.vb--idle { background: var(--p-idle); color: var(--text-secondary); }
.vb--correct { color: var(--p-correct); border-color: currentColor; background: transparent; }
.vb--wrong { color: var(--p-wrong); border-color: currentColor; background: transparent; }
.vb--pending { color: var(--p-pending); border-color: currentColor; background: transparent; }
</style>
