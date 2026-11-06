<!-- src/views/Practice/OjProblem.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownBody from '../../components/AI/MarkdownBody.vue'
import CodeEditor from '../../components/practice/CodeEditor.vue'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import VerdictBadge from '../../components/practice/VerdictBadge.vue'
import { useTheme } from '../../composables/useTheme'
import { errorText } from '../../api/practice/errors'
import {
  OJ_DIFFICULTY_TEXT,
  OJ_LANGUAGES,
  acceptRatePercent,
  fetchOjProblem,
  fetchOjSubmission,
  formatBytesLimit,
  isTerminal,
  submitOjSolution,
  type OjProblem,
  type OjSubmission,
} from '../../api/practice/oj'

const route = useRoute()
const router = useRouter()
const theme = useTheme()

const POLL_INTERVAL_MS = 800
/** 后端单题超时默认 2s、最多几十个用例，正常几秒就出结果；60s 是兜底，不是预期 */
const POLL_GIVE_UP_MS = 60_000

const problem = ref<OjProblem | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)

const language = ref(OJ_LANGUAGES[0].code)
const code = ref(OJ_LANGUAGES[0].starter)
const submitError = ref<string | null>(null)
const submitting = ref(false)
const submission = ref<OjSubmission | null>(null)

const problemId = computed(() => Number(route.params.id))
const judging = computed(() => submitting.value
    || (submission.value !== null && !isTerminal(submission.value.status)))

/** 后端按 UTF-8 字节数卡长度，所以这里也用字节数而不是字符数 */
const codeBytes = computed(() => new TextEncoder().encode(code.value).length)
const overLimit = computed(() => problem.value !== null
    && problem.value.maxSourceBytes > 0
    && codeBytes.value > problem.value.maxSourceBytes)

let pollTimer: number | null = null
let pollToken = 0

function stopPolling(): void {
  pollToken++
  if (pollTimer !== null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function starterOf(languageCode: string): string {
  return OJ_LANGUAGES.find(l => l.code === languageCode)?.starter ?? ''
}

/**
 * 切语言连同代码骨架一起换。
 * 之前只在"代码等于某个默认模板"时才换，而带 templateCode 的题一旦载入模板就
 * 再也不满足这个条件 —— 于是切语言后高亮变了、代码没变，提交出去必然是编译错误。
 */
function onLanguageChange(next: string): void {
  language.value = next
  code.value = starterOf(next)
}

async function load(): Promise<void> {
  if (!Number.isInteger(problemId.value) || problemId.value <= 0) {
    loadError.value = '题目编号不合法'
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const loaded = await fetchOjProblem(problemId.value)
    problem.value = loaded
    // 模板优先用题目自带的（作者按题意写好的骨架），没有才用语言默认模板
    code.value = loaded.templateCode?.trim() ? loaded.templateCode : starterOf(language.value)
  } catch (err) {
    loadError.value = errorText(err) ?? '题目加载失败'
  } finally {
    loading.value = false
  }
}

async function poll(submissionId: number): Promise<void> {
  const mine = ++pollToken
  const deadline = Date.now() + POLL_GIVE_UP_MS
  while (Date.now() < deadline) {
    await new Promise<void>(resolve => {
      pollTimer = window.setTimeout(resolve, POLL_INTERVAL_MS)
    })
    if (mine !== pollToken) return
    try {
      const next = await fetchOjSubmission(submissionId)
      if (mine !== pollToken) return
      submission.value = next
      if (isTerminal(next.status)) {
        submitting.value = false
        // 判完刷新一次题目：提交/通过次数与通过率都变了
        void load()
        return
      }
    } catch (err) {
      if (mine !== pollToken) return
      submitting.value = false
      submitError.value = errorText(err) ?? '查询判题结果失败'
      return
    }
  }
  submitting.value = false
  submitError.value = '判题时间过长，请稍后到提交记录里查看结果'
}

async function submit(): Promise<void> {
  if (!problem.value) return
  if (!code.value.trim()) {
    submitError.value = '代码不能为空'
    return
  }
  submitError.value = null
  submitting.value = true
  submission.value = null
  stopPolling()
  try {
    const { submissionId } = await submitOjSolution({
      problemId: problem.value.id,
      language: language.value,
      sourceCode: code.value,
    })
    // 先占位成"排队中"，这样按钮立刻禁用、结果区立刻有反馈，不用等第一次轮询
    submission.value = {
      id: submissionId, status: 'PENDING', score: 0, total: 0,
      timeUsedMs: 0, errorMsg: null, createTime: null,
    }
    await poll(submissionId)
  } catch (err) {
    submitting.value = false
    submitError.value = errorText(err) ?? '提交失败'
  }
}

function backToList(): void {
  void router.push({ name: 'practice-oj' })
}

watch(problemId, () => {
  stopPolling()
  submission.value = null
  submitError.value = null
  void load()
})

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="oj">
    <ErrorBar v-if="loadError" :message="loadError" @dismiss="loadError = null" />
    <p v-if="loading && !problem" class="oj-tip">正在加载题目…</p>

    <EmptyState v-else-if="!problem" title="题目不存在或已下架" hint="它可能被作者停用了。">
      <button class="oj-btn oj-btn--ghost" type="button" @click="backToList">返回题目列表</button>
    </EmptyState>

    <template v-else>
      <header class="oj-head">
        <button class="oj-back" type="button" @click="backToList">← 题目列表</button>
        <div class="oj-head__main">
          <span class="oj-head__id">{{ `OJ-${String(problem.id).padStart(3, '0')}` }}</span>
          <h1 class="oj-head__title">{{ problem.title }}</h1>
        </div>
        <div class="oj-head__meta">
          <span class="oj-chip" :class="`oj-chip--d${problem.difficulty}`">
            {{ OJ_DIFFICULTY_TEXT[problem.difficulty] ?? '未知' }}
          </span>
          <span class="oj-chip">提交 {{ problem.submitCount }}</span>
          <span class="oj-chip">通过 {{ problem.acceptedCount }}</span>
          <span class="oj-chip oj-chip--rate">通过率 {{ acceptRatePercent(problem.acceptRate) }}</span>
        </div>
      </header>

      <div class="oj-body">
        <!-- 左：题面 -->
        <section class="oj-panel oj-desc">
          <p class="oj-label">题目描述</p>
          <MarkdownBody :source="problem.description" :done="true" />

          <div v-if="problem.samples.length" class="oj-samples">
            <p class="oj-label">示例</p>
            <div v-for="s in problem.samples" :key="s.seq" class="oj-sample">
              <div class="oj-sample__col">
                <span class="oj-sample__h">输入 #{{ s.seq }}</span>
                <pre class="oj-pre">{{ s.inputData }}</pre>
              </div>
              <div class="oj-sample__col">
                <span class="oj-sample__h">期望输出</span>
                <pre class="oj-pre">{{ s.expectedOutput }}</pre>
              </div>
            </div>
          </div>

          <div class="oj-limits">
            <p class="oj-label">限制</p>
            <dl class="oj-limits__grid">
              <div class="oj-limits__item">
                <dt>时间限制</dt>
                <dd>{{ problem.timeLimitMs }} ms</dd>
              </div>
              <div class="oj-limits__item">
                <dt>内存限制</dt>
                <dd>{{ problem.memoryLimitMb }} MB</dd>
              </div>
              <div class="oj-limits__item">
                <dt>代码长度限制</dt>
                <dd>{{ formatBytesLimit(problem.maxSourceBytes) }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- 右：编辑器 + 判题结果 -->
        <section class="oj-panel oj-editor">
          <div class="oj-editor__bar">
            <select
                class="oj-select"
                :value="language"
                :disabled="judging"
                @change="onLanguageChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="l in OJ_LANGUAGES" :key="l.code" :value="l.code">{{ l.label }}</option>
            </select>
            <span class="oj-size" :class="{ 'oj-size--bad': overLimit }">
              {{ formatBytesLimit(codeBytes) }} / {{ formatBytesLimit(problem.maxSourceBytes) }}
            </span>
            <button class="oj-btn" type="button" :disabled="judging || overLimit" @click="submit">
              {{ judging ? '判题中…' : '提交' }}
            </button>
          </div>

          <CodeEditor
              v-model="code"
              :language="language"
              :theme="theme"
              :disabled="judging"
          />

          <ErrorBar v-if="submitError" :message="submitError" @dismiss="submitError = null" />

          <div v-if="submission" class="oj-result">
            <div class="oj-result__head">
              <VerdictBadge :status="submission.status" />
              <span v-if="isTerminal(submission.status)" class="oj-result__score">
                {{ submission.score }} / {{ submission.total }} 用例通过
              </span>
              <span v-if="submission.timeUsedMs > 0" class="oj-result__time">
                最大耗时 {{ submission.timeUsedMs }}ms
              </span>
            </div>
            <p v-if="!isTerminal(submission.status)" class="oj-result__hint">
              判题进行中，结果会自动刷新，不用手动点。
            </p>
            <pre v-if="submission.errorMsg" class="oj-pre oj-pre--err">{{ submission.errorMsg }}</pre>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.oj { display: flex; flex-direction: column; gap: 14px; min-height: 0; max-width: 1240px; width: 100%; margin: 0 auto; }
.oj-tip { margin: 0; padding: 24px 0; text-align: center; color: var(--text-muted); font-size: 13px; }

/* ---------- 顶部标题条 ---------- */
.oj-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 0 2px; }
.oj-back {
  border: 0; background: transparent; color: var(--text-muted);
  font: inherit; font-size: 12px; cursor: pointer; padding: 4px 0;
}
.oj-back:hover { color: var(--text-primary); }
.oj-head__main { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.oj-head__id { color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.oj-head__title { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.02em; }
.oj-head__meta { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.oj-chip {
  padding: 3px 9px; border-radius: 999px; border: 1px solid var(--divider);
  color: var(--text-muted); font-size: 11px; white-space: nowrap;
}
.oj-chip--d1 { color: var(--p-correct); border-color: currentColor; }
.oj-chip--d2 { color: var(--p-pending); border-color: currentColor; }
.oj-chip--d3 { color: var(--p-wrong); border-color: currentColor; }
.oj-chip--rate { color: var(--text-secondary); }

/* ---------- 双栏 ---------- */
.oj-body {
  display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 14px; min-height: 0; align-items: start;
}
.oj-panel {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px; border-radius: 14px;
  background: var(--bg-elevated); border: 1px solid var(--glass-border);
  min-height: 0;
}
.oj-desc { max-height: calc(100vh - 210px); overflow: auto; }
.oj-label { margin: 0; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; }

/* ---------- 示例 ---------- */
.oj-samples { display: flex; flex-direction: column; gap: 8px; }
.oj-sample { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.oj-sample__col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oj-sample__h { font-size: 11px; color: var(--text-muted); }

.oj-pre {
  margin: 0; padding: 10px 12px; border-radius: 8px;
  background: var(--glass-bg); border: 1px solid var(--divider);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px; line-height: 1.6;
  white-space: pre-wrap; overflow-wrap: anywhere;
  max-height: 220px; overflow: auto;
}
.oj-pre--err { color: var(--p-error-fg); background: var(--p-error-bg); }

/* ---------- 限制 ---------- */
.oj-limits { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.oj-limits__grid {
  margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px; overflow: hidden; border-radius: 10px;
  background: var(--divider); border: 1px solid var(--divider);
}
.oj-limits__item { padding: 10px 12px; background: var(--bg-elevated); }
.oj-limits__item dt { color: var(--text-muted); font-size: 11px; }
.oj-limits__item dd { margin: 3px 0 0; font-size: 13px; font-weight: 550; font-variant-numeric: tabular-nums; }

/* ---------- 编辑器 ---------- */
.oj-editor { max-height: calc(100vh - 210px); }
.oj-editor__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.oj-select {
  flex: 1; min-width: 130px; padding: 7px 10px; border-radius: 8px;
  background: var(--glass-bg); color: var(--text-primary);
  border: 1px solid var(--glass-border); cursor: pointer;
}
.oj-size { color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.oj-size--bad { color: var(--p-wrong); }
.oj-btn {
  flex: none; padding: 7px 18px; border-radius: 8px; cursor: pointer;
  background: var(--text-primary); color: var(--primary-contrast);
  border: 1px solid transparent; font-weight: 600;
  transition: opacity 0.2s ease;
}
.oj-btn:hover:not(:disabled) { opacity: 0.85; }
.oj-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.oj-btn--ghost { background: transparent; color: var(--text-primary); border-color: var(--glass-border-strong); }

.oj-result {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px; border-radius: 10px;
  background: var(--glass-bg); border: 1px solid var(--divider);
}
.oj-result__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.oj-result__score { font-size: 13px; font-weight: 600; }
.oj-result__time { font-size: 12px; color: var(--text-muted); }
.oj-result__hint { margin: 0; font-size: 12px; color: var(--text-muted); }

@media (max-width: 1023px) {
  .oj-body { grid-template-columns: minmax(0, 1fr); }
  .oj-desc, .oj-editor { max-height: none; }
  .oj-head__meta { margin-left: 0; }
}

@media (max-width: 767px) {
  .oj-panel { padding: 14px; }
  .oj-sample { grid-template-columns: 1fr; }
  .oj-limits__grid { grid-template-columns: 1fr; }
}
</style>
