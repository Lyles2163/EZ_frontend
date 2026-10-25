// src/api/sse.ts
/**
 * 唯一的 SSE 手工解帧处。EventSource 用不了：它不能 POST、也不能带 Authorization。
 * 这个文件刻意不 import request.ts / 不用 import.meta.env，所以能被 node --test 直接跑。
 *
 * 后端契约（实测，见后端仓库 2026-10-25-ai-chat-thinking-line-e2e-log.md）：
 * 帧以 \n\n 分隔；我们下游写 data:{…}（无空格），上游 DeepSeek 写 data: {…}（有空格）；
 * ping 在正文正常滚动时也会插进来。
 */

export interface SseFrame {
  event: string
  data: string
}

export interface MetaPayload {
  conversationId: number
  messageId: number
  modelKey: string
  effort: string
  supportsThinking: boolean
}

export interface UsagePayload {
  promptTokens: number | null
  completionTokens: number | null
  reasoningTokens: number | null
}

export interface ErrorPayload {
  errorCode: string
  msg: string
  retryable: boolean
}

export interface ChatStreamHandlers {
  onMeta?(meta: MetaPayload): void
  onThoughtStep?(text: string): void
  onThoughtEnd?(seconds: number): void
  onDelta?(text: string): void
  onUsage?(usage: UsagePayload): void
  onDone?(finishReason: string): void
  onError?(error: ErrorPayload): void
}

/** 只声明用到的部分，测试里能手搓一个假 Response。 */
export interface ResponseLike {
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | null
  json(): Promise<unknown>
  text(): Promise<string>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseBlock(block: string): SseFrame | null {
  let event = ''
  const data: string[] = []
  for (const line of block.split('\n')) {
    // 空行与 ": keep-alive" 这类注释行都不是字段
    if (!line || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    // 只吃掉「最多一个」前导空格：后端无空格、上游有空格，两种都得正确
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  if (!event && data.length === 0) return null
  return { event: event || 'message', data: data.join('\n') }
}

export function splitFrames(buffer: string): { frames: SseFrame[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n')
  // 最后一段一定是还没收全的尾巴 —— 网络不按帧给你边界
  const rest = parts.pop() ?? ''
  const frames: SseFrame[] = []
  for (const block of parts) {
    const frame = parseBlock(block)
    if (frame) frames.push(frame)
  }
  return { frames, rest }
}

export function dispatchFrame(frame: SseFrame, handlers: ChatStreamHandlers): void {
  let payload: Record<string, unknown> = {}
  if (frame.data) {
    try {
      const parsed: unknown = JSON.parse(frame.data)
      if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>
    } catch {
      // 坏帧丢过去，不让一整条流卡死
      return
    }
  }
  switch (frame.event) {
    case 'meta':
      handlers.onMeta?.({
        conversationId: asNumberOrNull(payload.conversationId) ?? 0,
        messageId: asNumberOrNull(payload.messageId) ?? 0,
        modelKey: asString(payload.modelKey),
        effort: asString(payload.effort),
        supportsThinking: payload.supportsThinking === true
      })
      return
    case 'thought_step':
      handlers.onThoughtStep?.(asString(payload.text))
      return
    case 'thought_end':
      handlers.onThoughtEnd?.(asNumberOrNull(payload.seconds) ?? 0)
      return
    case 'delta':
      handlers.onDelta?.(asString(payload.text))
      return
    case 'usage':
      handlers.onUsage?.({
        promptTokens: asNumberOrNull(payload.promptTokens),
        completionTokens: asNumberOrNull(payload.completionTokens),
        reasoningTokens: asNumberOrNull(payload.reasoningTokens)
      })
      return
    case 'done':
      handlers.onDone?.(asString(payload.finishReason) || 'done')
      return
    case 'error':
      handlers.onError?.({
        errorCode: asString(payload.errorCode),
        msg: asString(payload.msg),
        retryable: payload.retryable === true
      })
      return
    default:
      // ping 与将来新增的事件：忽略，而不是报错。前端不该因为后端多发一类帧就断流。
      return
  }
}

export async function readEventStream(
  res: ResponseLike,
  handlers: ChatStreamHandlers,
  onReject?: (msg: string) => void
): Promise<void> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    // 建流前的业务拒绝是 Result(JSON)。对着 JSON 跑帧解析器表现为「静默无响应」，极难排查，
    // 所以这一步必须在读 body 之前判掉。
    let msg = '请求被拒绝'
    try {
      const body: unknown = await res.json()
      if (body && typeof body === 'object') {
        const envelope = body as { msg?: unknown; message?: unknown }
        msg = asString(envelope.msg) || asString(envelope.message) || msg
      }
    } catch {
      // JSON 解析失败就用兜底文案
    }
    onReject?.(msg)
    return
  }
  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    // stream: true 的语义：多字节字符被劈在两片之间时不乱码
    buffer += decoder.decode(value, { stream: true })
    const { frames, rest } = splitFrames(buffer)
    buffer = rest
    for (const frame of frames) dispatchFrame(frame, handlers)
  }
  buffer += decoder.decode()
  // 收尾：服务端最后不一定留空行，补一个才能把尾巴当完整帧切出来
  const { frames } = splitFrames(`${buffer}\n\n`)
  for (const frame of frames) dispatchFrame(frame, handlers)
}
