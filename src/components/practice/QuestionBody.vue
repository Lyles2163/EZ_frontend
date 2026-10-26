<!-- src/components/practice/QuestionBody.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import JellyRadio from '../JellyRadio.vue'
import {
  TYPE_BLANK, TYPE_ESSAY, TYPE_JUDGE, TYPE_MULTI, TYPE_SINGLE, blankSlots,
  type AnswerValue,
} from '../../api/practice/answer'
import type { Question } from '../../api/practice/types'

const props = defineProps<{ question: Question; modelValue: AnswerValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: AnswerValue] }>()

const radioItems = computed(() =>
  props.question.options.map(o => ({ value: o.optionKey, label: `${o.optionKey}. ${o.content}` })))

const selectedKey = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''))

const multiSelected = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [])

/**
 * 填空的两条分支只由 blankSlots 决定：数得出槽数 → N 个输入框；数不出来 → 一个 textarea
 * （上送的是"按行切出来的 string[]"）。blankList 为空就是"该走 textarea"的信号，
 * 所以它只从 blankSlots 取，不看 modelValue 的长度。
 */
const slotCount = computed<string[] | null>(() => blankSlots(props.question.title))

const blankList = computed<string[]>(() => {
  if (slotCount.value === null) return []
  return Array.isArray(props.modelValue) ? props.modelValue : slotCount.value
})

const freeformText = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.join('\n') : '')

const essayText = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''))

function setSingle(value: string): void {
  emit('update:modelValue', value)
}

function toggleOption(key: string): void {
  const next = multiSelected.value.includes(key)
    ? multiSelected.value.filter(k => k !== key)
    : [...multiSelected.value, key]
  emit('update:modelValue', next)
}

function setBlank(index: number, value: string): void {
  const next = [...blankList.value]
  next[index] = value
  emit('update:modelValue', next)
}

function setFreeform(value: string): void {
  emit('update:modelValue', value.split('\n'))
}

const JUDGE_OPTIONS = [{ value: true, label: '对' }, { value: false, label: '错' }] as const
</script>

<template>
  <div class="qbody">
    <p class="qhead">
      <span class="qtype">{{ question.typeName }}</span>
      <span v-if="question.index !== null" class="qmeta">第 {{ question.index }} 题</span>
      <span v-if="question.difficulty !== null" class="qmeta">难度 {{ question.difficulty }}</span>
      <span v-for="t in question.tags" :key="t" class="qtag">{{ t }}</span>
    </p>

    <p class="qtitle">{{ question.title }}</p>

    <!-- 1 单选：JellyRadio 只 emit change（没有 update:value，不能 v-model） -->
    <JellyRadio
        v-if="question.type === TYPE_SINGLE"
        :items="radioItems"
        :value="selectedKey"
        aria-label="选择一个选项"
        @change="setSingle"
    />

    <!-- 2 多选 -->
    <ul v-else-if="question.type === TYPE_MULTI" class="opts">
      <li v-for="o in question.options" :key="o.optionKey">
        <label class="opt">
          <input
              type="checkbox"
              :checked="multiSelected.includes(o.optionKey)"
              @change="toggleOption(o.optionKey)"
          />
          <span>{{ o.optionKey }}. {{ o.content }}</span>
        </label>
      </li>
    </ul>

    <!-- 3 判断 -->
    <div v-else-if="question.type === TYPE_JUDGE" class="judge">
      <button
          v-for="opt in JUDGE_OPTIONS"
          :key="opt.label"
          class="chip"
          :class="{ 'chip--on': modelValue === opt.value }"
          type="button"
          @click="emit('update:modelValue', opt.value)"
      >{{ opt.label }}</button>
    </div>

    <!-- 4 填空 -->
    <div v-else-if="question.type === TYPE_BLANK" class="blanks">
      <template v-if="blankList.length > 0">
        <label v-for="(slot, i) in blankList" :key="i" class="blank">
          <span class="blank-no">第 {{ i + 1 }} 空</span>
          <input
              :value="slot"
              type="text"
              @input="setBlank(i, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>
      <textarea
          v-else
          class="essay"
          rows="4"
          placeholder="多个空按行分隔"
          :value="freeformText"
          @input="setFreeform(($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- 5 简答 -->
    <textarea
        v-else-if="question.type === TYPE_ESSAY"
        class="essay"
        rows="5"
        placeholder="作答后点击提交，之后自行判断是否答对"
        :value="essayText"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <!-- 未知题型：明确说出来，不渲染一张空表单骗人往下点 -->
    <p v-else class="unknown">这道题的题型（{{ question.type }}）还不支持作答。</p>
  </div>
</template>

<style scoped>
.qbody { display: flex; flex-direction: column; gap: 12px; }
.qhead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 12px; color: var(--text-muted); }
.qtype {
  padding: 2px 8px; border-radius: 999px;
  background: var(--glass-bg); color: var(--text-secondary);
}
.qtitle { margin: 0; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
.opts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.opt { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.opt input { width: 16px; height: 16px; accent-color: var(--primary-500); }
.judge { display: flex; gap: 10px; }
.chip {
  min-width: 72px; padding: 8px 14px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-primary); font: inherit; cursor: pointer;
}
.chip--on { border-color: var(--primary-500); font-weight: 600; }
.blanks { display: flex; flex-direction: column; gap: 10px; }
.blank { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }
.blank input {
  flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--divider);
  border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); font: inherit;
}
.essay {
  width: 100%; padding: 10px; border: 1px solid var(--divider); border-radius: 10px;
  background: var(--bg-elevated); color: var(--text-primary); font: inherit;
  resize: vertical; box-sizing: border-box;
}
.unknown { color: var(--p-wrong); font-size: 13px; }
</style>
