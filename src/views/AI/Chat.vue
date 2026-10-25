<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConversationList from '../../components/AI/ConversationList.vue'
import MessageItem from '../../components/AI/MessageItem.vue'
import PromptBar from '../../components/AI/PromptBar.vue'
import type { PromptBarSendDetail } from '../../components/AI/PromptBar.vue'
import { useChat } from '../../composables/useChat'
import { useTheme } from '../../composables/useTheme'

const theme = useTheme()
const chat = useChat()

// useChat 返回的是「装着 ref 的普通对象」：模板里只有顶层 ref 会自动解构，
// chat.messages 是嵌套属性，所以一次性解构出来用，避免 .value 与不解构混写。
const {
  catalog, catalogError, conversations, nextCursor, activeId, messages,
  sending, errorText, currentModel, currentModelSupportsThinking
} = chat

const showList = ref(false)
const scroller = ref<HTMLElement | null>(null)

const promptColors = computed(() =>
  theme.value === 'light'
    ? { background: '#ffffff', color: '#0d0d0d', menuBackground: '#ffffff', sparkColor: '#8ab4ff' }
    : { background: '#2a2a2a', color: '#ececec', menuBackground: '#2a2a2a', sparkColor: '#6ea8ff' }
)

/**
 * #1 的目录必须显式喂给 PromptBar：它自带的 DEFAULT_MODELS 是 gpt-5.5 那类演示值，
 * 不传的话用户选到的模型是假的，发出去只会被后端拒成「不支持的模型」。
 * sources/commands 同理留空 —— @ 菜单里的「Photos & files / Sales data」都不存在。
 */
const barModels = computed(() =>
  (catalog.value?.models ?? []).map(m => ({ key: m.key, name: m.name, tag: m.tag }))
)
const barEfforts = computed(() => catalog.value?.efforts ?? [])
const defaultModel = computed(() => catalog.value?.defaultModel ?? '')
const defaultEffort = computed(() => catalog.value?.defaultEffort ?? '')
const hasMessages = computed(() => messages.value.length > 0)

const scrollToEnd = (): void => {
  requestAnimationFrame(() => {
    const el = scroller.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const send = async (text: string, detail: PromptBarSendDetail): Promise<void> => {
  await chat.send(text, detail.model?.key, detail.effort)
  scrollToEnd()
}

const open = async (id: number): Promise<void> => {
  await chat.openConversation(id)
  showList.value = false
  scrollToEnd()
}

const create = async (): Promise<void> => {
  await chat.startConversation()
  showList.value = false
}

const attach = (): string[] => []
const dictate = (): string => ''

// 流式期间也要跟到底部：新增的行与逐帧涨长的正文是两个不同的触发源
watch(() => messages.value.length, scrollToEnd)
watch(
  () => messages.value[messages.value.length - 1]?.content.length ?? 0,
  scrollToEnd
)

onMounted(async () => {
  await chat.loadCatalog()
  await chat.loadConversations()
})
</script>

<template>
  <section class="chat-page">
    <ConversationList
        v-if="showList"
        :items="conversations"
        :active-id="activeId"
        :has-more="!!nextCursor"
        @select="open"
        @create="create"
        @more="chat.moreConversations"
    />

    <div class="chat-main">
      <header class="chat-head">
        <button class="chat-toggle" @click="showList = !showList">对话列表</button>
        <span v-if="currentModel" class="chat-model">
          {{ currentModel.name }}
          <em v-if="currentModelSupportsThinking">· 思考线</em>
        </span>
      </header>

      <div v-if="!hasMessages" class="chat-hero">
        <h1 class="greeting">问点什么</h1>
      </div>

      <div v-else ref="scroller" class="chat-scroll">
        <MessageItem
            v-for="turn in messages"
            :key="turn.key"
            :turn="turn"
            @retry="chat.retry"
            @regenerate="chat.regenerate"
        />
      </div>

      <p v-if="errorText || catalogError" class="chat-error">{{ errorText || catalogError }}</p>

      <div class="prompt-wrap">
        <PromptBar
            placeholder="问点什么"
            :busy="sending"
            :sources="[]"
            :commands="[]"
            :models="barModels"
            :default-model="defaultModel"
            :efforts="barEfforts"
            :default-effort="defaultEffort"
            :on-attach="attach"
            :on-dictate="dictate"
            :background="promptColors.background"
            :color="promptColors.color"
            :menu-background="promptColors.menuBackground"
            :spark-color="promptColors.sparkColor"
            :spark-boost="1"
            :width="680"
            :radius="26"
            :max-rows="5"
            :morph-duration="240"
            :squash="0.12"
            :tilt="8"
            :press-scale="0.96"
            @send="send"
            @stop="chat.stop"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat-page {
  flex: 1;
  min-height: 0;
  display: flex;
}
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0 24px 20px;
}
.chat-head {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  flex: none;
}
.chat-toggle {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.chat-model { font-size: 13px; color: var(--text-muted); }
.chat-model em { font-style: normal; color: var(--text); }
.chat-hero {
  flex: 1;
  display: grid;
  place-content: center;
  gap: 24px;
}
.greeting {
  margin: 0;
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 500;
  letter-spacing: -0.02em;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0 16px;
}
.chat-error {
  flex: none;
  margin: 0 0 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text);
  background: color-mix(in srgb, #e5484d 10%, transparent);
}
.prompt-wrap {
  flex: none;
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
}
@media (max-width: 767px) {
  .chat-main { padding: 0 14px 14px; }
}
</style>
