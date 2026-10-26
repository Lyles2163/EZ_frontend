// src/utils/datetime.ts
/** 接口给的时间一律 epoch 毫秒；没有记录时后端给 null，这里回占位符而不是 1970。 */
const FALLBACK = '—'

export function formatDateTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return FALLBACK
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms))
}
