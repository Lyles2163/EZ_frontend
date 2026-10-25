<script setup lang="ts">
import { computed } from 'vue'
import MarkdownBody from './MarkdownBody.vue'
import ThoughtLine from './ThoughtLine.vue'
import type { ChatTurn } from '../../composables/useChat'

const props = defineProps<{ turn: ChatTurn }>()

// retry 不带 id：重试的语义是「复用上一次 payload 与幂等键」，状态在 useChat 里，
// 气泡不该决定重试哪一条。
const emit = defineEmits<{
  retry: []
  regenerate: []
}>()

/**
 * 只有真的跑过流才渲染思考线：reasoning 不落库，历史行的 steps 恒空，
 * 刷新重进会话时思考线消失是预期结果，不是 bug。
 */
const showThought = computed(() => props.turn.steps.length > 0 || props.turn.thinkingOpen)

/** truncated + 空正文 = 用户在模型还在思考时就按了停止。 */
const stoppedWhileThinking = computed(
  () => props.turn.status === 'truncated' && props.turn.settled && !props.turn.content
)
const label = computed(() => (props.turn.failed ? '思考中断' : '思考中…'))
const doneLabel = computed(() =>
  props.turn.failed ? '思考中断' : `已思考 ${(props.turn.elapsed ?? 0).toFixed(1)} 秒`
)
/** 历史行的失败不能就地重试（手里没有那一轮的 payload）。 */
const showActions = computed(() => props.turn.failed && !props.turn.fromHistory)
</script>

<template>
  <div class="turn" :class="{ 'turn-user': turn.role === 'user' }">
    <div v-if="turn.role === 'assistant'" class="turn-ai">
      <ThoughtLine
          v-if="showThought"
          :steps="turn.steps"
          :working="turn.thinkingOpen"
          :elapsed="turn.elapsed ?? undefined"
          :label="label"
          :done-label="doneLabel"
          :settle-after="0"
          :step-shimmer="true"
          :shimmer="false"
          :breath-depth="0"
      />
      <MarkdownBody v-if="turn.content" :source="turn.content" :done="turn.settled" />
      <p v-else-if="stoppedWhileThinking" class="turn-note">已停止（模型还在思考）</p>
      <p v-else-if="turn.status === 'truncated'" class="turn-note">回答在此中断</p>

      <div v-if="showActions" class="turn-actions">
        <button class="turn-retry" @click="emit('retry')">重试</button>
        <button class="turn-regen" @click="emit('regenerate')">重新生成</button>
      </div>
    </div>
    <p v-else class="turn-body">{{ turn.content }}</p>
  </div>
</template>

<style scoped>
.turn { display: flex; padding: 6px 0; }
.turn-user { justify-content: flex-end; }
.turn-ai {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.turn-body {
  margin: 0;
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--sb-active);
  color: var(--text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.turn-note {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.turn-actions { display: flex; gap: 8px; }
.turn-retry,
.turn-regen {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.turn-retry:hover,
.turn-regen:hover { background: var(--sb-hover); }
</style>
