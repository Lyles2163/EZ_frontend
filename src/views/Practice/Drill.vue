<!-- src/views/Practice/Drill.vue -->
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
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

/** 裁定七的守门人就是它：showAnswer false 时这一段整块不渲染（参考答案先藏着） */
const revealedResult = computed(() => (drill.showAnswer.value ? drill.result.value : null))

function dismissError(): void {
  drill.error.value = null
}

/**
 * 首屏、换科、深链接三件事共用一个 watch：
 * - `immediate` 覆盖"科目已经在 useSubjects 缓存里"（从别的练习页切回来）那种首屏；
 * - `loadedFor` 挡住重复触发 —— 少了它，ensure() 填 currentSubject 时会与 onMounted 各发
 *   一次 card/current，而且那次还会用 navigateTo(mode) 把 URL 上的 questionId 擦掉，
 *   "从错题本跳进某一题"当场失效（收藏本判据③）；
 * - 只有真的换了科目（first=false）才清掉上一科遗留的 questionId。
 */
let loadedFor: number | null = null

function loadForSubject(first: boolean): void {
  void drill.loadCard()
  if (first) openCurrent()
  else navigateTo({ kind: 'mode', mode: drill.mode.value })
}

onMounted(() => { void ensure() })

watch(() => currentSubject.value?.id, id => {
  if (typeof id !== 'number' || id === loadedFor) return
  const first = loadedFor === null
  loadedFor = id
  loadForSubject(first)
}, { immediate: true })

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

      <!--
        面板的条件是 result || canJudge：只有 result 时，"刷新后重进一道待自评的题"
        这条流就没有任何自评入口（pendingRecordId 明明在，按钮却渲染不出来），
        用户只能重新答一遍。裁定七照旧由 showAnswer 守 —— 它在没有 result 时返回 false，
        所以这一版不会把参考答案提前漏出来。
      -->
      <div v-if="drill.result.value || drill.canJudge.value" class="panel glass-lite">
        <p class="verdict">
          <template v-if="drill.canJudge.value">这道题不自动判分，请自评。</template>
          <template v-else-if="drill.result.value?.isCorrect">答对了</template>
          <template v-else>答错了</template>
        </p>

        <!-- showAnswer 为 true 时必然有 result（它在 result 为 null 时返回 false），
             但模板推不出这层关系，所以在这里窄化一次给 vue-tsc 看 -->
        <template v-if="revealedResult">
          <p class="row"><b>正确答案</b><code>{{ revealedResult.correctAnswerJson }}</code></p>
          <p v-if="revealedResult.analysis" class="row"><b>解析</b>{{ revealedResult.analysis }}</p>
          <p v-if="drill.stat.value" class="row">
            <b>科目统计</b>共 {{ drill.stat.value.total }} 题 · 对 {{ drill.stat.value.correct }} ·
            错 {{ drill.stat.value.wrong }} · 正确率 {{ percent(drill.stat.value.accuracy) }}
          </p>
          <p class="row">
            <b>本题</b>累计答错 {{ revealedResult.wrongCount }} 次
            <span v-if="revealedResult.wrongMastered">· 已掌握</span>
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
