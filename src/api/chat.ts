// src/api/chat.ts
/**
 * 对话模块接口层。控制面走 request.ts（Result 信封、错误类型、令牌注入都已在那边收口），
 * 流式走自己的 fetch —— 那边有 15s 的 AbortSignal.timeout，长回答必然被自己掐断。
 *
 * 类型逐条对齐后端 record（AIModule/.../chat/web/dto/），字段名与可空性都不是我拟的：
 * ChatUsageVo 只有 prompt/completion 两槽（reasoning 不落库），MessagePageVo 的列表字段叫 items。
 */
import { apiUrl, request } from './request'
import { readEventStream, type ChatStreamHandlers } from './sse'

export interface ChatModel {
  key: string
  name: string
  tag?: string
  supportsThinking: boolean
}

export interface ModelCatalog {
  defaultModel: string
  defaultEffort: string
  efforts: string[]
  models: ChatModel[]
}

export interface Conversation {
  id: number
  title: string
  modelKey: string
  effort: string
  messageCount: number
  lastPreview: string
  /** 后端给 epoch 毫秒（LocalDateTime 经 Jackson 的输出） */
  updateTime: number
}

export interface ConversationPage {
  items: Conversation[]
  nextCursor: string | null
}

export interface ChatUsage {
  promptTokens: number | null
  completionTokens: number | null
}

export interface ChatMessage {
  id: number
  conversationId: number
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'failed' | 'truncated' | 'superseded'
  modelKey: string | null
  effort: string | null
  stopReason: string | null
  usage: ChatUsage | null
  createTime: number
}

export interface MessagePage {
  hasMore: boolean
  items: ChatMessage[]
}

export interface StreamPayload {
  conversationId: number
  content?: string
  modelKey?: string
  effort?: string
  clientMsgId?: string
  regenerate?: boolean
}

export const fetchModelCatalog = (): Promise<ModelCatalog> =>
  request<ModelCatalog>('/ai/chat/models')

export const createConversation = (body: { modelKey?: string; effort?: string }): Promise<Conversation> =>
  request<Conversation>('/ai/chat/conversations', { method: 'POST', body })

export const listConversations = (cursor?: string): Promise<ConversationPage> =>
  request<ConversationPage>(
    `/ai/chat/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  )

export const listMessages = (id: number, beforeId?: number): Promise<MessagePage> =>
  request<MessagePage>(
    `/ai/chat/conversations/${id}/messages${beforeId ? `?beforeId=${beforeId}` : ''}`
  )

export const stopMessage = (id: number): Promise<null> =>
  request<null>(`/ai/chat/messages/${id}/stop`, { method: 'POST' })

/**
 * 幂等键。后端靠 uk_conv_client 保证重试不产生第二条用户消息，所以重试必须复用同一个值 ——
 * 这也是为什么它由调用方（useChat）持有、而不是在这里现生成。
 */
export function newClientMsgId(): string {
  return crypto.randomUUID()
}

export interface StreamHandlers extends ChatStreamHandlers {
  /** 建流前的业务拒绝（HTTP 200 + Result JSON），msg 是后端中文原文 */
  onReject?(msg: string): void
}

/**
 * Accept 给双值：后端在非流式请求时会直出 JSON 拒绝，只写 text/event-stream 就拿不到那段中文。
 */
export async function streamChat(
  payload: StreamPayload,
  handlers: StreamHandlers,
  token: string | null,
  signal?: AbortSignal
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json'
  }
  // 网关严格判前缀：必须正好是 "Bearer "（小写或缺空格一律 401）
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(apiUrl('/ai/chat/completions/stream'), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  })
  await readEventStream(res, handlers, handlers.onReject)
}
