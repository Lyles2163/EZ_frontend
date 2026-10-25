import test from 'node:test'
import assert from 'node:assert/strict'
import { splitFrames, parseBlock, dispatchFrame, readEventStream, type SseFrame } from '../sse.ts'

test('splitFrames：完整帧切出来，半帧留在 rest 里', () => {
  const { frames, rest } = splitFrames('event:delta\ndata:{"text":"你"}\n\nevent:delta\ndata:{"te')
  assert.equal(frames.length, 1)
  assert.equal(frames[0].event, 'delta')
  assert.equal(frames[0].data, '{"text":"你"}')
  assert.equal(rest, 'event:delta\ndata:{"te')
})

test('splitFrames：CRLF 与多行 data 都归一', () => {
  const { frames } = splitFrames('event:delta\r\ndata:{"text":"a"}\r\n\r\n')
  assert.deepEqual(frames, [{ event: 'delta', data: '{"text":"a"}' }])
})

test('parseBlock：data: 后最多只去掉一个前导空格', () => {
  assert.equal(parseBlock('data:{"a":1}')?.data, '{"a":1}')
  assert.equal(parseBlock('data: {"a":1}')?.data, '{"a":1}')
  assert.equal(parseBlock('data:  {"a":1}')?.data, ' {"a":1}', '两个空格只吃掉一个')
})

test('parseBlock：忽略注释行与没有 event 名的帧', () => {
  assert.equal(parseBlock(': keep-alive'), null)
  assert.deepEqual(parseBlock('data:{"text":"x"}'), { event: 'message', data: '{"text":"x"}' })
})

test('dispatchFrame：七类事件各自进对应回调，ping 与未知事件什么都不做', () => {
  const seen: string[] = []
  const h = {
    onMeta: () => seen.push('meta'),
    onThoughtStep: () => seen.push('step'),
    onThoughtEnd: () => seen.push('end'),
    onDelta: () => seen.push('delta'),
    onUsage: () => seen.push('usage'),
    onDone: () => seen.push('done'),
    onError: () => seen.push('error')
  }
  const f = (event: string): SseFrame => ({ event, data: '{}' })
  for (const e of ['meta', 'thought_step', 'thought_end', 'delta', 'usage', 'ping', 'done', 'error'])
    dispatchFrame(f(e), h)
  assert.deepEqual(seen, ['meta', 'step', 'end', 'delta', 'usage', 'done', 'error'], 'ping 不产出，且顺序不乱')
})

test('dispatchFrame：thought_step 的 text 与 thought_end 的 seconds 取到值', () => {
  let step = ''
  let seconds = 0
  dispatchFrame({ event: 'thought_step', data: '{"text":"先算乘法。"}' }, { onThoughtStep: t => { step = t } })
  dispatchFrame({ event: 'thought_end', data: '{"seconds":8.4}' }, { onThoughtEnd: s => { seconds = s } })
  assert.equal(step, '先算乘法。')
  assert.equal(seconds, 8.4)
})

test('readEventStream：撕裂字节（7 字节一片）拼回完整帧，一个都不丢', async () => {
  const body =
    'event:meta\ndata:{"conversationId":1,"messageId":2,"modelKey":"deepseek-reasoner","effort":"Medium","supportsThinking":true}\n\n' +
    'event:thought_step\ndata:{"text":"先算乘法。"}\n\n' +
    'event:thought_end\ndata:{"seconds":0.4}\n\n' +
    'event:delta\ndata:{"text":"391"}\n\n' +
    'event:usage\ndata:{"promptTokens":44,"completionTokens":128,"reasoningTokens":55}\n\n' +
    'event:done\ndata:{"finishReason":"done"}\n\n'
  const bytes = new TextEncoder().encode(body)
  const chunks: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.slice(i, i + 7))
  const res = {
    headers: { get: () => 'text/event-stream' },
    body: new ReadableStream<Uint8Array>({
      start(c) { for (const ch of chunks) c.enqueue(ch); c.close() }
    }),
    json: async () => ({}),
    text: async () => ''
  }
  const order: string[] = []
  let usage: { reasoningTokens: number | null } | null = null
  await readEventStream(res as never, {
    onMeta: () => order.push('meta'),
    onThoughtStep: () => order.push('step'),
    onThoughtEnd: () => order.push('end'),
    onDelta: () => order.push('delta'),
    onUsage: u => { order.push('usage'); usage = u },
    onDone: () => order.push('done')
  })
  assert.deepEqual(order, ['meta', 'step', 'end', 'delta', 'usage', 'done'])
  assert.equal((usage as unknown as { reasoningTokens: number | null }).reasoningTokens, 55)
})

test('readEventStream：流结束时最后一帧没补空行也要发出来', async () => {
  const res = {
    headers: { get: () => 'text/event-stream' },
    body: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('event:delta\ndata:{"text":"好"}'))
        c.close()
      }
    }),
    json: async () => ({}),
    text: async () => ''
  }
  let tail = ''
  await readEventStream(res as never, { onDelta: t => { tail = t } })
  assert.equal(tail, '好')
})

test('readEventStream：content-type 是 JSON 时走 onReject，绝不进帧解析器', async () => {
  const res = {
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json;charset=UTF-8' : null) },
    body: null,
    json: async () => ({ code: 0, msg: '上一条回答仍在生成' }),
    text: async () => ''
  }
  let rejected = ''
  let delta = 0
  await readEventStream(res as never, { onDelta: () => { delta++ } }, msg => { rejected = msg })
  assert.equal(rejected, '上一条回答仍在生成')
  assert.equal(delta, 0)
})

test('readEventStream：error 帧不抛异常（HTTP 仍是 200），走 onError', async () => {
  const body = 'event:error\ndata:{"errorCode":"UPSTREAM_MODEL_ERROR","msg":"模型服务暂时不可用","retryable":true}\n\n'
  const res = {
    headers: { get: () => 'text/event-stream' },
    body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close() } }),
    json: async () => ({}),
    text: async () => ''
  }
  let err: { retryable: boolean } | null = null
  await readEventStream(res as never, { onError: e => { err = e } })
  assert.equal((err as unknown as { retryable: boolean }).retryable, true)
})
