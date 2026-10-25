// src/composables/useChat.ts
/**
 * 流式状态的唯一持有处：组件只读它，不自己攒 content/steps。
 *
 * 三条规则是上一期踩过或证伪过的，改代码前先读完注释：
 * 1. 两段式停止（见 stop）—— 先本地冻结，再异步通知后端；
 * 2. retry 复用同一个 clientMsgId，regenerate 换新键（幂等键 + regenerate 标志是两套语义）；
 * 3. reasoning 不落库（用户 2026-10-24 的决定）—— 历史行的 steps 恒为空，刷新后思考线消失是预期行为。
 */
import { computed, onScopeDispose, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { nextPumpDelay } from './thinkingPace'
import {
  createConversation,
  fetchModelCatalog,
  listConversations,
  listMessages,
  newClientMsgId,
  stopMessage,
  streamChat,
  type ChatMessage,
  type ChatModel,
  type Conversation,
  type ModelCatalog,
  type StreamPayload
} from '../api/chat'
import type { ErrorPayload, MetaPayload, UsagePayload } from '../api/sse'

export type ChatTurnStatus = 'streaming' | 'done' | 'failed' | 'truncated' | 'superseded'

/** 一条消息在 UI 里的完整形状：历史行与流式中的行共用同一个类型，模板里就不用分两套分支。 */
export interface ChatTurn {
  key: string
  id?: number
  role: 'user' | 'assistant'
  content: string
  status: ChatTurnStatus
  stopReason: string | null
  usage: UsagePayload | null
  steps: string[]
  thinkingOpen: boolean
  /** 秒。ThoughtLine 的 elapsed 单位就是秒（它内部 ×10 自己走 10Hz 的钟） */
  elapsed: number | null
  settled: boolean
  failed: boolean
  retryable: boolean
  /** reasoning 不落库 → 历史行没有思考线，只有本次会话内真跑过的流才有 */
  fromHistory: boolean
  clientMsgId?: string
}

/** 后端 ChatStreamService 实际会往 done 帧里塞这几个串（AiMessage.STOP_*） */
const TRUNCATED_REASONS = new Set(['stopped', 'length', 'timeout', 'client_disconnect'])

export function useChat() {
  const auth = useAuthStore()

  const catalog = ref<ModelCatalog | null>(null)
  const catalogError = ref('')
  const conversations = ref<Conversation[]>([])
  const nextCursor = ref<string | null>(null)
  const activeId = ref<number | null>(null)
  const messages = ref<ChatTurn[]>([])
  const sending = ref(false)
  const errorText = ref('')

  let turn: ChatTurn | null = null
  let controller: AbortController | null = null
  /** 重试要复用这一份（含原 clientMsgId）；新一轮发送才换值 */
  let lastPayload: StreamPayload | null = null

  /**
   * 思考行的放帧队列。同一时刻只有一个活跃 turn，所以队列是单个闭包变量而不是 Map。
   *
   * 为什么要队列：后端一句一帧，但浏览器一次 read 能收到好几帧，直接 push 就是「几行同时冒出来」。
   * endSeen 表示 thought_end 已到或流已结束 —— 只有「pending 排空 + endSeen」才收思考线，
   * 这就是"等队列放完再收"。代价：思考线会比正文晚收最多 pending × 220ms（追平逻辑下通常远小于）。
   */
  let thinking: {
    target: ChatTurn
    pending: string[]
    seconds: number | null
    endSeen: boolean
    timer: ReturnType<typeof setTimeout> | null
  } | null = null

  const closeThinking = (): void => {
    const q = thinking
    if (!q) return
    if (q.timer != null) clearTimeout(q.timer)
    q.timer = null
    thinking = null
    q.target.thinkingOpen = false
    q.target.elapsed = q.seconds
  }

  const pumpThinking = (): void => {
    const q = thinking
    if (!q || q.timer != null) return
    if (q.pending.length === 0) {
      if (q.endSeen) closeThinking()
      return
    }
    q.timer = setTimeout(() => {
      const cur = thinking
      if (!cur) return
      cur.timer = null
      const line = cur.pending.shift()
      if (line) cur.target.steps.push(line)
      pumpThinking()
    }, nextPumpDelay(q.pending.length))
  }

  /** 强制收口：停止 / 出错 / 业务拒绝 / 切会话 / 新一轮发送时不等动画，剩下的行一次放完再收。 */
  const flushThinking = (): void => {
    const q = thinking
    if (!q) return
    if (q.pending.length) {
      q.target.steps.push(...q.pending)
      q.pending.length = 0
    }
    closeThinking()
  }

  const activeModelKey = (): string | undefined =>
    conversations.value.find(c => c.id === activeId.value)?.modelKey ?? catalog.value?.defaultModel

  const currentModel = computed<ChatModel | null>(
    () => catalog.value?.models.find(m => m.key === activeModelKey()) ?? catalog.value?.models[0] ?? null
  )
  /** 单一口径：能力来自 #1 的目录，不是前端猜的 */
  const currentModelSupportsThinking = computed(() => currentModel.value?.supportsThinking === true)

  const loadCatalog = async (): Promise<void> => {
    if (catalog.value) return
    try {
      catalog.value = await fetchModelCatalog()
    } catch (err) {
      catalogError.value = messageOf(err)
    }
  }

  const loadConversations = async (): Promise<void> => {
    try {
      const page = await listConversations()
      conversations.value = page.items
      nextCursor.value = page.nextCursor
    } catch (err) {
      errorText.value = messageOf(err)
    }
  }

  const moreConversations = async (): Promise<void> => {
    const cursor = nextCursor.value
    if (!cursor) return
    try {
      const page = await listConversations(cursor)
      const known = new Set(conversations.value.map(c => c.id))
      conversations.value = [...conversations.value, ...page.items.filter(c => !known.has(c.id))]
      nextCursor.value = page.nextCursor
    } catch (err) {
      errorText.value = messageOf(err)
    }
  }

  const openConversation = async (id: number): Promise<void> => {
    abortLocal()
    activeId.value = id
    errorText.value = ''
    try {
      const page = await listMessages(id)
      messages.value = page.items.map(toTurn)
    } catch (err) {
      messages.value = []
      errorText.value = messageOf(err)
    }
  }

  const startConversation = async (): Promise<void> => {
    abortLocal()
    try {
      const created = await createConversation({
        modelKey: currentModel.value?.key,
        effort: catalog.value?.defaultEffort
      })
      conversations.value = [created, ...conversations.value]
      activeId.value = created.id
      messages.value = []
      errorText.value = ''
    } catch (err) {
      errorText.value = messageOf(err)
    }
  }

  const send = async (text: string, modelKey?: string, effort?: string): Promise<void> => {
    if (!text || sending.value) return
    if (activeId.value == null) await startConversation()
    const conversationId = activeId.value
    if (conversationId == null) return

    lastPayload = {
      conversationId,
      content: text,
      modelKey: modelKey ?? activeModelKey(),
      effort: effort ?? catalog.value?.defaultEffort,
      clientMsgId: newClientMsgId(),
      regenerate: false
    }
    await run(lastPayload)
  }

  /** 重新生成：不带 content，后端按 regenerate 复用上个问题并把旧答案置 superseded。 */
  const regenerate = async (): Promise<void> => {
    if (sending.value || activeId.value == null || !lastPayload) return
    // superseded 不进对话流（MessageQueryService 把它过滤了），所以本地也得撤掉，
    // 否则刷新前会看见一条刷新后就消失的旧答案。
    const lastIndex = findLastAssistant()
    if (lastIndex >= 0) messages.value.splice(lastIndex, 1)
    await run({
      conversationId: activeId.value,
      modelKey: lastPayload.modelKey,
      effort: lastPayload.effort,
      clientMsgId: newClientMsgId(),
      regenerate: true
    })
  }

  /** 复用 lastPayload（含原 clientMsgId）：后端靠 uk_conv_client 保证不产生第二条用户消息。 */
  const retry = async (): Promise<void> => {
    if (sending.value || !lastPayload) return
    await run(lastPayload)
  }

  const stop = (): void => {
    // 两段式：先本地冻结（用户立刻看到停住了），再异步通知后端。
    // 反过来等 /stop 返回，卡的是网关一个往返，用户 perceive 到的是「停止按钮没反应」。
    if (turn && !turn.settled) {
      turn.settled = true
      turn.thinkingOpen = false
      turn.status = 'truncated'
    }
    // 停止是用户主动要的「现在就停」，所以队列不再逐行放，一次倒完就收
    flushThinking()
    sending.value = false
    controller?.abort()
    const id = turn?.id
    if (id != null) void stopMessage(id).catch(() => undefined)
  }

  const run = async (payload: StreamPayload): Promise<void> => {
    sending.value = true
    errorText.value = ''

    const userKey = `u-${payload.clientMsgId}`
    const assistantKey = `a-${payload.clientMsgId ?? 'regenerate'}`
    // retry 会复用同一个 clientMsgId → 同一对 key：问题行不重复推，失败的答位先撤掉。
    if (payload.content && !messages.value.some(m => m.key === userKey)) {
      messages.value.push({
        key: userKey,
        role: 'user',
        content: payload.content,
        status: 'done',
        stopReason: null,
        usage: null,
        steps: [],
        thinkingOpen: false,
        elapsed: null,
        settled: true,
        failed: false,
        retryable: false,
        fromHistory: false,
        clientMsgId: payload.clientMsgId
      })
    }
    const stale = messages.value.findIndex(m => m.key === assistantKey)
    if (stale >= 0) messages.value.splice(stale, 1)

    turn = {
      key: assistantKey,
      role: 'assistant',
      content: '',
      status: 'streaming',
      stopReason: null,
      usage: null,
      steps: [],
      thinkingOpen: false,
      elapsed: null,
      settled: false,
      failed: false,
      retryable: false,
      fromHistory: false,
      clientMsgId: payload.clientMsgId
    }
    messages.value.push(turn)
    // push 进 ref([]) 之后必须把引用换成数组里的代理对象：直接改原始对象不会触发重渲染，
    // 流式期间就会出现「数据在涨、界面不动」。
    turn = messages.value[messages.value.length - 1]
    const activeTurn = turn
    // 上一轮还有没放完的思考行就先倒完收起，再开这一轮的队列
    flushThinking()
    thinking = { target: activeTurn, pending: [], seconds: null, endSeen: false, timer: null }
    controller = new AbortController()
    try {
      await streamChat(payload, handlersFor(activeTurn), auth.token, controller.signal)
    } catch (err) {
      if (!isAbort(err)) errorText.value = messageOf(err)
    } finally {
      activeTurn.settled = true
      sending.value = false
      controller = null
      void loadConversations()
      // 这里不再直接收思考线：正文已经开始流了，队列还得把最后几行放完（用户要的是「等队列放完再收」）
      const q = thinking
      if (q && q.target === activeTurn) {
        q.endSeen = true
        pumpThinking()
      }
    }
  }

  /**
   * 帧 → 状态。每个回调只认自己那一格：thought_step 只进队列，delta 只写 content。
   * 之所以每次都用 activeTurn 而不是模块级的 turn：切换会话会把 turn 置空，
   * 而迟到的帧仍会打进来 —— 让它写到自己那份快照上，不会污染新会话。
   * 队列同理：只有 `thinking.target === target` 时才认这一帧，否则是上一轮的迟到帧。
   */
  const handlersFor = (target: ChatTurn) => ({
    onMeta: (meta: MetaPayload) => {
      target.id = meta.messageId
      if (!meta.supportsThinking) target.thinkingOpen = false
    },
    onThoughtStep: (step: string) => {
      const q = thinking
      if (!step || target.settled || !q || q.target !== target) return
      target.thinkingOpen = true
      q.pending.push(step)
      pumpThinking()
    },
    onThoughtEnd: (seconds: number) => {
      const q = thinking
      if (!q || q.target !== target) {
        target.thinkingOpen = false
        target.elapsed = seconds
        return
      }
      // 不在这里收：记下秒数，等队列放完由 closeThinking 收
      q.seconds = seconds
      q.endSeen = true
      pumpThinking()
    },
    onDelta: (piece: string) => {
      if (piece && !target.settled) target.content += piece
    },
    onUsage: (usage: UsagePayload) => {
      target.usage = usage
    },
    onDone: (reason: string) => {
      target.settled = true
      target.stopReason = reason
      target.status = reason === 'upstream' ? 'failed' : TRUNCATED_REASONS.has(reason) ? 'truncated' : 'done'
      if (target.status === 'failed') target.failed = true
    },
    onError: (err: ErrorPayload) => {
      target.failed = true
      target.retryable = err.retryable
      target.settled = true
      flushThinking()
      errorText.value = err.msg
    },
    onReject: (msg: string) => {
      // 建流前就被拒绝：这条 assistant 占位根本没开始生成，撤掉它，问题行留着好改。
      errorText.value = msg
      flushThinking()
      const index = messages.value.indexOf(target)
      if (index >= 0) messages.value.splice(index, 1)
      target.settled = true
    }
  })

  const abortLocal = (): void => {
    if (turn && !turn.settled) {
      turn.settled = true
      turn.thinkingOpen = false
    }
    flushThinking()
    controller?.abort()
    controller = null
  }

  const findLastAssistant = (): number => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') return i
    }
    return -1
  }

  // 离开页面时不留悬空 timer：队列里没放的行就不放了，这里只保证不把定时器漏给 GC。
  // 注意不能在这里 flushThinking —— 那时组件已在卸载，往响应式数组里追加没有意义。
  onScopeDispose(() => {
    const q = thinking
    if (q && q.timer != null) clearTimeout(q.timer)
    thinking = null
  })

  return {
    catalog,
    catalogError,
    conversations,
    nextCursor,
    activeId,
    messages,
    sending,
    errorText,
    currentModel,
    currentModelSupportsThinking,
    loadCatalog,
    loadConversations,
    moreConversations,
    openConversation,
    startConversation,
    send,
    stop,
    regenerate,
    retry
  }
}

function toTurn(item: ChatMessage): ChatTurn {
  return {
    key: `h-${item.id}`,
    id: item.id,
    role: item.role,
    content: item.content,
    status: item.status,
    stopReason: item.stopReason,
    // 历史里的 usage 只有两槽；reasoningTokens 恒 null，因为 reasoning 不落库
    usage: item.usage ? { ...item.usage, reasoningTokens: null } : null,
    steps: [],
    thinkingOpen: false,
    elapsed: null,
    settled: true,
    failed: item.status === 'failed',
    retryable: false,
    fromHistory: true
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : '请求失败，请稍后重试'
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}
