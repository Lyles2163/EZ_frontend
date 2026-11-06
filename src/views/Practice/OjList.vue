<!-- src/views/Practice/OjList.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { errorText } from '../../api/practice/errors'
import {
  OJ_DIFFICULTY_TEXT,
  acceptRatePercent,
  fetchOjProblems,
  type OjProblemItem,
} from '../../api/practice/oj'

const router = useRouter()
const problems = ref<OjProblemItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    problems.value = await fetchOjProblems()
  } catch (err) {
    error.value = errorText(err) ?? '题目列表加载失败'
  } finally {
    loading.value = false
  }
}

function openProblem(id: number): void {
  void router.push({ name: 'practice-oj-problem', params: { id: String(id) } })
}

onMounted(load)
</script>

<template>
  <div class="oj-list">
    <header class="oj-list__head">
      <div>
        <p class="oj-eyebrow">ONLINE JUDGE</p>
        <h1 class="oj-list__title">编程题</h1>
        <p class="oj-list__sub">选择一道题，编写代码并提交评测。</p>
      </div>
      <div class="oj-total"><strong>{{ problems.length }}</strong><span>道题目</span></div>
    </header>

    <ErrorBar v-if="error" :message="error" @dismiss="error = null" />
    <p v-if="loading && !problems.length" class="oj-tip">正在加载题目…</p>
    <EmptyState
        v-else-if="!problems.length"
        title="还没有编程题"
        hint="题目上架后会显示在这里。"
    />

    <section v-else class="oj-table-wrap" aria-label="编程题列表">
      <div class="oj-table oj-table--head" aria-hidden="true">
        <span>题号</span><span>标题</span><span>难度</span>
        <span class="oj-table__center">提交 / 通过</span><span class="oj-table__rate">通过率</span>
      </div>
      <button
          v-for="p in problems"
          :key="p.id"
          class="oj-table oj-row"
          type="button"
          @click="openProblem(p.id)"
      >
        <span class="oj-id">{{ `OJ-${String(p.id).padStart(3, '0')}` }}</span>
        <span class="oj-name">{{ p.title }}</span>
        <span class="oj-difficulty" :class="`oj-difficulty--${p.difficulty}`">
          {{ OJ_DIFFICULTY_TEXT[p.difficulty] ?? '未知' }}
        </span>
        <span class="oj-count oj-table__center">{{ p.submitCount }} / {{ p.acceptedCount }}</span>
        <span class="oj-rate">
          <span class="oj-rate__track"><span class="oj-rate__fill" :style="{ width: acceptRatePercent(p.acceptRate) }" /></span>
          <span class="oj-rate__label">{{ acceptRatePercent(p.acceptRate) }}</span>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.oj-list { display: flex; flex-direction: column; gap: 20px; max-width: 1120px; width: 100%; margin: 0 auto; }
.oj-list__head { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 2px 2px 4px; }
.oj-eyebrow { margin: 0 0 5px; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; }
.oj-list__title { margin: 0; font-size: 25px; line-height: 1.2; font-weight: 650; letter-spacing: -0.03em; }
.oj-list__sub { margin: 7px 0 0; color: var(--text-muted); font-size: 13px; }
.oj-total { display: flex; flex-direction: column; align-items: end; gap: 2px; color: var(--text-muted); font-size: 11px; }
.oj-total strong { color: var(--text-primary); font-size: 23px; line-height: 1.2; font-weight: 650; font-variant-numeric: tabular-nums; }
.oj-tip { margin: 0; padding: 36px 0; text-align: center; color: var(--text-muted); font-size: 13px; }

.oj-table-wrap { overflow-x: auto; border-top: 1px solid var(--divider); }
.oj-table {
  display: grid; grid-template-columns: 112px minmax(180px, 1fr) 86px 128px minmax(150px, 220px);
  align-items: center; gap: 16px; width: 100%; padding: 13px 12px;
}
.oj-table--head { color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--divider); }
.oj-table__center { text-align: center; }
.oj-row {
  border: 0; border-bottom: 1px solid var(--divider); text-align: left; cursor: pointer;
  background: transparent; color: var(--text-secondary); font: inherit; font-size: 12px;
  transition: background 0.16s ease;
}
.oj-row:hover { background: var(--glass-bg-hover); }
.oj-id { color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.oj-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-weight: 550; }
.oj-difficulty { font-size: 11px; }
.oj-difficulty--1 { color: var(--p-correct); }
.oj-difficulty--2 { color: var(--p-pending); }
.oj-difficulty--3 { color: var(--p-wrong); }
.oj-count { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.oj-rate { display: flex; align-items: center; gap: 10px; min-width: 0; }
.oj-rate__track { flex: 1; height: 4px; overflow: hidden; border-radius: 999px; background: var(--divider); }
.oj-rate__fill { display: block; height: 100%; min-width: 0; border-radius: inherit; background: var(--text-primary); transition: width 0.2s ease; }
.oj-rate__label { width: 42px; text-align: right; color: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }

@media (max-width: 767px) {
  .oj-list { gap: 16px; }
  .oj-list__title { font-size: 22px; }
  .oj-table { grid-template-columns: 72px minmax(150px, 1fr) 58px 100px 140px; gap: 10px; padding-inline: 8px; }
  .oj-table--head { font-size: 10px; }
  .oj-row { font-size: 11px; }
}
</style>
