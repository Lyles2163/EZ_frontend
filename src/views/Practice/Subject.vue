<!-- src/views/Practice/Subject.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { formatDateTime } from '../../utils/datetime'
import type { SubjectItem } from '../../api/practice/types'

const router = useRouter()
const { subjects, loading, error, reload, ensure, store } = useSubjects()

onMounted(ensure)

/** myAccuracy 是 0~1 的比值（后端 SubjectItemVO 的口径），不是百分数 */
function percent(accuracy: number): string {
  return `${Math.round(accuracy * 10000) / 100}%`
}

function open(s: SubjectItem): void {
  store.setSubject(s.id)
  void router.push({ name: 'practice-drill' })
}

function dismissError(): void {
  error.value = null
}
</script>

<template>
  <section class="subject">
    <header class="head">
      <h1 class="title">科目总览</h1>
      <button class="ghost" type="button" :disabled="loading" @click="reload">
        {{ loading ? '加载中…' : '刷新' }}
      </button>
    </header>

    <ErrorBar v-if="error" :message="error" @dismiss="dismissError" />

    <EmptyState v-else-if="!loading && subjects.length === 0"
                title="还没有可练习的科目"
                hint="题库里没有启用中的题目，或科目都被停用了。" />

    <div v-else class="grid">
      <button
          v-for="s in subjects"
          :key="s.id"
          class="card glass-lite"
          type="button"
          @click="open(s)"
      >
        <p class="card-title">{{ s.name }}</p>
        <p v-if="s.description" class="card-desc">{{ s.description }}</p>
        <dl class="stats">
          <div><dt>题目</dt><dd>{{ s.questionCount }}</dd></div>
          <div><dt>已答</dt><dd>{{ s.myTotal }}</dd></div>
          <div><dt>答对</dt><dd>{{ s.myCorrect }}</dd></div>
          <div><dt>正确率</dt><dd>{{ percent(s.myAccuracy) }}</dd></div>
        </dl>
        <p class="last">上次作答：{{ formatDateTime(s.lastAnswerAt) }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.subject { display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.title { margin: 0; font-size: 18px; }
.ghost {
  padding: 6px 12px; border: 1px solid var(--divider); border-radius: 8px;
  background: transparent; color: var(--text-secondary); font: inherit; cursor: pointer;
}
.ghost:disabled { opacity: .6; cursor: default; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.card {
  padding: 16px; border: 1px solid var(--divider); border-radius: 12px;
  text-align: left; font: inherit; color: inherit; cursor: pointer;
}
.card:hover { border-color: var(--glass-border-strong); }
.card-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.card-desc { margin: 0 0 10px; font-size: 12px; color: var(--text-muted); }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; margin: 0; }
.stats div { display: flex; justify-content: space-between; }
.stats dt { color: var(--text-muted); font-size: 12px; }
.stats dd { margin: 0; font-size: 13px; }
.last { margin: 10px 0 0; font-size: 12px; color: var(--text-muted); }
</style>
