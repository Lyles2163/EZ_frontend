import type { GenerationRecord } from '../../../api/image'

export function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
}

export function formatDateTime(ts: number): string {
  const date = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function countImages(record: GenerationRecord) {
  let succeeded = 0
  let failed = 0
  let pending = 0
  for (const image of record.images) {
    if (image.status === 'succeeded') succeeded++
    else if (image.status === 'failed') failed++
    else pending++
  }
  return { succeeded, failed, pending, total: record.images.length }
}
