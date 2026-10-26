<!-- src/views/Practice/Drill.vue -->
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnswerCard from '../../components/practice/AnswerCard.vue'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import QuestionBody from '../../components/practice/QuestionBody.vue'
import { useDrill, type DrillTarget } from '../../composables/useDrill'
import { useSubjects } from '../../composables/useSubjects'

const route = useRoute()
const router = useRouter()
const { current: currentSubject, ensure } = useSubjects()
const drill = useDrill(() => currentSubject.value?.id ?? null)

/** URL 上的 questionId 是"我在做哪一题"的唯一真相：刷新要能还原，错题本也要能跳进来 */
function queryQuestionId(): number | null {
  const raw = route.query.questionId
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function openCurrent(): void {
  const qid = queryQuestionId()
  void drill.open(qid !== null ? { kind: 'question', questionId: qid } : { kind: 'mode', mode: drill.mode.value })
}

/**
 * 先改 URL、由 watch 去取题，这样"点下一题"和"点答题卡某一格"都留得下痕迹（刷新能还原）。
 * URL 已经就是目标时才直接取 —— 否则 router.replace 不会触发 watch，点了没反应。
 */
function navigateTo(target: DrillTarget): void {
  const wanted = target.kind === 'question' ? String(target.questionId) : ''
  const current = queryQuestionId() === null ? '' : String(queryQuestionId())
  if (wanted === current) {
    void drill.open(target)
    return
  }
  void router.replace({
    name: 'practice-drill',
    query: wanted ? { questionId: wanted } : {},
  })
}

function selectCell(questionId: number): void {
  navigateTo({ kind: 'question', questionId })
}

function nextQuestion(): void {
  navigateTo({ kind: 'mode', mode: drill.mode.value })
}

function percent(accuracy: number): string {
  return `${Math.round(accuracy * 10000) / 100}%`
}

function dismissError(): void {
  drill.error.value = null
}

onMounted(async () => {
  await ensure()
  if (!currentSubject.value) return
  void drill.loadCard()
  openCurrent()
})

// 点侧栏科目时人已经停在 /practice/drill：路由不变、组件不重挂，
// 所以换科目必须看 currentSubject 的 id，否则答题卡与题目都停在上一科
watch(() => currentSubject.value?.id, () => {
  void drill.loadCard()
  navigateTo({ kind: 'mode', mode: drill.mode.value })
})

// 从错题本/答题卡进来是同一个页面，只是 query 变了
watch(() => route.query.questionId, openCurrent)
</script>

<template>
  <section class="drill">
    <header class="head">
      <div class="head-main">
        <h1 class="title">{{ currentSubject?.name ?? '未选题' }}</h1>
        <p v-if="currentSubject" class="stat">
          共 {{ currentSubject.questionCount }} 题 · 已答 {{ currentSubject.myTotal }} ·
          正确率 {{ percent(currentSubject.myAccuracy) }}
        </p>
      </div>
      <div class="modes">
        <button class="chip" :class="{ 'chip--on': drill.mode.value === 1 }"
                type="button" @click="navigateTo({ kind: 'mode', mode: 1 })">顺序练习</button>
        <button class="chip" :class="{ 'chip--on': drill.mode.value === 3 }"
                type="button" @click="navigateTo({ kind: 'mode', mode: 3 })">智能练习</button>
      </div>
      <button class="ghost" type="button" @click="drill.toggleFav()">
        {{ drill.favorited.value ? '取消收藏' : '收藏本题' }}
      </button>
    </header>

    <ErrorBar v-if="drill.error.value" :message="drill.error.value" @dismiss="dismissError" />

    <EmptyState v-if="drill.finished.value"
                title="这一科已经全部作答"
                hint="换个模式，或者去错题本看看没掌握的题目。">
      <button class="ghost" type="button" @click="navigateTo({ kind: 'mode', mode: 3 })">智能练习</button>
    </EmptyState>

    <template v-else-if="drill.question.value">
      <QuestionBody
          :question="drill.question.value"
          :model-value="drill.model.value"
          @update:model-value="drill.model.value = $event"
      />

      <div class="actions">
        <button class="primary" type="button" :disabled="drill.busy.value" @click="drill.submit()">
          {{ drill.busy.value ? '提交中…' : '提交答案' }}
        </button>
        <button v-if="drill.result.value" class="ghost" type="button" @click="nextQuestion()">下一题</button>
      </div>

      <p v-if="drill.judgedTip.value" class="tip">{{ drill.judgedTip.value }}</p>

      <!-- 解析面板：showAnswer 为 false 时参考答案先藏着（裁定七） -->
      <div v-if="drill.result.value" class="panel glass-lite">
        <p class="verdict">
          <template v-if="drill.result.value.needSelfJudge && !drill.revealed.value">
            这道题不自动判分，请自评。
          </template>
          <template v-else-if="drill.result.value.isCorrect">答对了</template>
          <template v-else>答错了</template>
        </p>

        <template v-if="drill.showAnswer.value">
          <p class="row"><b>正确答案</b><code>{{ drill.result.value.correctAnswerJson }}</code></p>
          <p v-if="drill.result.value.analysis" class="row"><b>解析</b>{{ drill.result.value.analysis }}</p>
          <p v-if="drill.stat.value" class="row">
            <b>科目统计</b>共 {{ drill.stat.value.total }} 题 · 对 {{ drill.stat.value.correct }} ·
            错 {{ drill.stat.value.wrong }} · 正确率 {{ percent(drill.stat.value.accuracy) }}
          </p>
          <p class="row">
            <b>本题</b>累计答错 {{ drill.result.value.wrongCount }} 次
            <span v-if="drill.result.value.wrongMastered">· 已掌握</span>
            <span v-else>· 未掌握</span>
          </p>
        </template>

        <div v-if="drill.canJudge.value" class="judge-actions">
          <button type="button" class="primary" :disabled="drill.judging.value" @click="drill.judge(true)">
            我答对了
          </button>
          <button type="button" class="ghost" :disabled="drill.judging.value" @click="drill.judge(false)">
            我答错了
          </button>
        </div>
      </div>
    </template>

    <p v-else-if="!drill.loading.value && !drill.error.value" class="tip">
      这道题暂时打不开，换个模式或去列表里点一道。
    </p>

    <AnswerCard
        :cells="drill.cardCells.value"
        :current-id="drill.currentId.value"
        @select="selectCell"
    />
  </section>
</template>

<style scoped>
.drill {
  display: flex; flex-direction: column; gap: 16px;
  max-width: 760px; margin: 0 auto; width: 100%;
}
.head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.head-main { flex: 1; min-width: 140px; }
.title { margin: 0; font-size: 17px; }
.stat { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
.modes { display: flex; gap: 6px; }
.chip, .ghost, .primary {
  padding: 7px 13px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-secondary); font: inherit; cursor: pointer;
}
.chip--on { border-color: var(--primary-500); color: var(--text-primary); font-weight: 600; }
.ghost { border-radius: 9px; }
.primary {
  border-radius: 9px; background: var(--primary-500); border-color: var(--primary-500);
  color: var(--primary-contrast);
}
.ghost:disabled, .primary:disabled { opacity: .6; cursor: default; }
.actions { display: flex; gap: 10px; }
.panel {
  padding: 14px; border: 1px solid var(--divider); border-radius: 12px;
  display: grid; gap: 8px;
}
.verdict { margin: 0; font-size: 15px; font-weight: 600; }
.row { margin: 0; font-size: 13px; color: var(--text-secondary); }
.row b { margin-right: 8px; color: var(--text-muted); font-weight: 500; }
.row code { padding: 2px 6px; border-radius: 6px; background: var(--glass-bg); }
.judge-actions { display: flex; gap: 10px; }
.tip { margin: 0; font-size: 13px; color: var(--text-muted); }
</style>
