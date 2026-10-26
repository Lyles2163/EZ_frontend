<!-- src/components/practice/AnswerCard.vue -->
<script setup lang="ts">
import type { DrillCardCell } from '../../composables/useDrill'
import type { CardState } from '../../api/practice/answer'

defineProps<{ cells: DrillCardCell[]; currentId: number | null }>()
const emit = defineEmits<{ select: [questionId: number] }>()

const TITLE: Record<CardState, string> = {
  idle: '未作答', correct: '答对', wrong: '答错', pending: '待自评',
}
</script>

<template>
  <div v-if="cells.length" class="card-area">
    <p class="legend">
      <span v-for="(text, state) in TITLE" :key="state" class="legend-item">
        <i class="dot" :class="`dot--${state}`" />{{ text }}
      </span>
    </p>
    <div class="grid">
      <button
          v-for="c in cells"
          :key="c.questionId"
          class="cell"
          :class="[`cell--${c.state}`, { 'cell--now': c.questionId === currentId }]"
          type="button"
          :title="`第 ${c.index} 题 · ${TITLE[c.state]}`"
          @click="emit('select', c.questionId)"
      >{{ c.index }}</button>
    </div>
  </div>
</template>

<style scoped>
.card-area { display: flex; flex-direction: column; gap: 8px; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 0; font-size: 12px; color: var(--text-muted); }
.legend-item { display: inline-flex; align-items: center; gap: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot--idle { background: var(--p-idle); border: 1px solid var(--divider); }
.dot--correct { background: var(--p-correct); }
.dot--wrong { background: var(--p-wrong); }
.dot--pending { background: var(--p-pending); }
.grid { display: flex; flex-wrap: wrap; gap: 6px; }
.cell {
  width: 32px; height: 32px; border-radius: 8px; font: inherit; font-size: 12px; cursor: pointer;
  border: 1px solid var(--divider); background: var(--p-idle); color: var(--text-secondary);
}
/* 态色之上的前景只取全局的 primary-contrast（主色上的文字色），不新增十六进制值 */
.cell--correct { background: var(--p-correct); border-color: var(--p-correct); color: var(--primary-contrast); }
.cell--wrong { background: var(--p-wrong); border-color: var(--p-wrong); color: var(--primary-contrast); }
.cell--pending { background: var(--p-pending); border-color: var(--p-pending); color: var(--text-primary); }
.cell--now { outline: 2px solid var(--primary-500); outline-offset: 1px; }
</style>
