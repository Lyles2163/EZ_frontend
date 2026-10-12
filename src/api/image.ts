// 生图接口层：当前为内存 mock，替换函数体即可对接真后端（签名保持不变）

export type ImageQuality = 'auto' | 'high' | 'medium' | 'low'
export type RecordStatus = 'queued' | 'running' | 'succeeded' | 'failed'
export type ImageStatus = 'pending' | 'succeeded' | 'failed'

export interface GeneratedImage {
  id: string
  url: string
  status: ImageStatus
  errorMessage?: string
}

export interface GenerationRecord {
  id: string
  prompt: string
  model: string
  quality: ImageQuality
  size: string
  createdAt: number
  durationMs: number
  status: RecordStatus
  images: GeneratedImage[]
}

export interface GenerateParams {
  prompt: string
  model: string
  quality: ImageQuality
  size: string
  count: number
  alignTo16: boolean
  references: string[]
}

export interface ReferenceImage {
  id: string
  name: string
  url: string
}

export interface ModelOption {
  value: string
  label: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { value: 'gpt-image-2', label: 'gpt-image-2' },
  { value: 'seedream-4', label: 'seedream-4' },
  { value: 'flux-1.1-pro', label: 'flux-1.1-pro' }
]

export const QUALITY_OPTIONS: { value: ImageQuality; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

export const SIZE_OPTIONS = ['1:1', '3:2', '2:3', '16:9', '9:16']

const LATENCY_MS = 260
const IMAGE_STEP_MS = 900

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** 本地生成的占位图，避免向外部域名发请求 */
function placeholderUrl(seed: number, label: string): string {
  const hue = (seed * 53) % 360
  const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue}, 68%, 62%)"/>` +
      `<stop offset="1" stop-color="hsl(${(hue + 72) % 360}, 62%, 34%)"/>` +
      `</linearGradient></defs>` +
      `<rect width="768" height="768" fill="url(#g)"/>` +
      `<text x="384" y="384" fill="rgba(255,255,255,.88)" font-family="sans-serif" font-size="64" text-anchor="middle">${label}</text>` +
      `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function makeSeedRecord(prompt: string, createdAt: number, durationMs: number, failed: number): GenerationRecord {
  const total = 1
  const images: GeneratedImage[] = Array.from({ length: total }, (_, i) => ({
    id: uid('img'),
    url: placeholderUrl(createdAt + i, `${i + 1}`),
    status: i < total - failed ? 'succeeded' : 'failed',
    ...(i >= total - failed ? { errorMessage: '内容审核未通过' } : {})
  }))
  return {
    id: uid('rec'),
    prompt,
    model: 'gpt-image-2',
    quality: 'auto',
    size: '1:1',
    createdAt,
    durationMs,
    status: failed > 0 ? 'failed' : 'succeeded',
    images
  }
}

const store: GenerationRecord[] = [
  makeSeedRecord('帮我生成一个虫子鸡蛋的电商主图，红色背景，促销风格', Date.now() - 1000 * 60 * 60 * 24 * 3, 163_000, 0),
  makeSeedRecord('claude-opus-4 主题海报，赛博朋克霓虹，竖版', Date.now() - 1000 * 60 * 60 * 24 * 2, 102_000, 0),
  makeSeedRecord('claude-opus-4 头像，极简线条，黑白', Date.now() - 1000 * 60 * 60 * 24 * 2, 127_000, 0),
  makeSeedRecord('claude-opus-4 壁纸，4K 风景，晨雾山谷', Date.now() - 1000 * 60 * 60 * 24 * 2, 149_000, 0),
  makeSeedRecord('claude-opus-4 图标集，扁平化，蓝色系', Date.now() - 1000 * 60 * 60 * 24, 8_000, 1)
]

export async function fetchModels(): Promise<ModelOption[]> {
  await delay(LATENCY_MS)
  return MODEL_OPTIONS
}

export async function fetchRecords(): Promise<GenerationRecord[]> {
  await delay(LATENCY_MS)
  return structuredClone(store).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteRecords(ids: string[]): Promise<void> {
  await delay(LATENCY_MS)
  for (let i = store.length - 1; i >= 0; i--) {
    if (ids.includes(store[i].id)) store.splice(i, 1)
  }
}

export async function uploadReference(file: File): Promise<ReferenceImage> {
  await delay(120)
  return { id: uid('ref'), name: file.name, url: URL.createObjectURL(file) }
}

/** 提交生成任务：立即返回 queued 记录，随后由定时器推进状态，前端轮询 fetchRecords 获取进度 */
export async function submitGeneration(params: GenerateParams): Promise<GenerationRecord> {
  await delay(LATENCY_MS)

  const createdAt = Date.now()
  const images: GeneratedImage[] = Array.from({ length: params.count }, (_, i) => ({
    id: uid('img'),
    url: '',
    status: 'pending' as ImageStatus
  }))

  const record: GenerationRecord = {
    id: uid('rec'),
    prompt: params.prompt,
    model: params.model,
    quality: params.quality,
    size: params.size,
    createdAt,
    durationMs: 0,
    status: 'queued',
    images
  }
  store.unshift(record)

  runTask(record, params)
  return structuredClone(record)
}

async function runTask(record: GenerationRecord, params: GenerateParams): Promise<void> {
  await delay(IMAGE_STEP_MS)
  record.status = 'running'

  for (const [i, image] of record.images.entries()) {
    await delay(IMAGE_STEP_MS * (params.quality === 'high' ? 2 : 1))
    // 约 12% 概率失败，用于演示失败态
    if (Math.random() < 0.12) {
      image.status = 'failed'
      image.errorMessage = '上游模型返回错误，请重试'
      continue
    }
    image.url = placeholderUrl(record.createdAt + i, `${i + 1}`)
    image.status = 'succeeded'
  }

  record.durationMs = Date.now() - record.createdAt
  record.status = record.images.some(img => img.status === 'failed')
      ? (record.images.every(img => img.status === 'failed') ? 'failed' : 'succeeded')
      : 'succeeded'
}
