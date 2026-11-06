// src/api/ragKb.ts
/**
 * 知识库文档管理接口层。对应后端 AIModule 的 org.leon.aimodule.rag.web.RagDocumentController。
 *
 * 类型逐条对齐后端 record（rag/ingest/DocumentVo.java 与 Controller 内的 ChunkVo），
 * 字段名与可空性都不是我拟的。后端刻意不返回 source_path 与 file_hash（内部细节），
 * 所以这里也没有这两个字段。
 *
 * 上传走 rawBody + 长超时，原因见 request.ts 的 RequestOptions 注释：
 * FormData 不能手工设 Content-Type，且 embedding 耗时远超默认 15s。
 */
import { request } from './request'

/** 与后端 RagDocument.ST_* 一致 */
export type DocStatus =
  | 'pending' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'failed'

export interface RagDoc {
  id: number
  fileName: string
  title: string
  book: string | null
  /** official=全用户可见；personal=仅上传者可见 */
  scope: 'official' | 'personal'
  ownerName: string
  /** 0=全学科通用；>0=具体学科 */
  subjectId: number
  mimeType: string | null
  fileSize: number | null
  status: DocStatus
  chunkCount: number
  tokenCount: number
  /** status=failed 时的原因；成功为 null */
  errorMsg: string | null
  createTime: number | null
  updateTime: number | null
}

export interface RagChunk {
  id: number
  seq: number
  tokenCount: number | null
  pageNo: number | null
  chapterPath: string | null
  indexStatus: 'pending' | 'embedded' | 'indexed' | 'failed'
  /** 后端已截断到 500 字，列表页展示用 */
  content: string
}

export interface UploadForm {
  file: File
  scope: 'official' | 'personal'
  title?: string
  book?: string
  subjectId?: number
}

/** 后端 rag.ingest.allowed-extensions 的默认值，前端用来限制选择器与预校验 */
export const ALLOWED_EXTENSIONS = ['txt', 'md', 'markdown', 'text'] as const

/** 与后端 rag.ingest.max-file-bytes（20MB）一致；multipart 上限也是 20MB */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i < 0 || i === fileName.length - 1 ? '' : fileName.slice(i + 1).toLowerCase()
}

/**
 * 上传前的本地预校验。
 * 后端会再校一遍（前端校验只为省一次往返与给出即时提示，不是安全边界）。
 */
export function validateFile(file: File): string | null {
  if (file.size === 0) return '文件是空的'
  if (file.size > MAX_FILE_BYTES) return `文件超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 上限`
  const ext = extensionOf(file.name)
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return `暂只支持 ${ALLOWED_EXTENSIONS.join(' / ')}，当前是 .${ext || '无扩展名'}`
  }
  return null
}

/** 入库是同步接口，要等 embedding 跑完，所以超时给足 5 分钟 */
export const uploadDocument = (form: UploadForm): Promise<RagDoc> => {
  const fd = new FormData()
  fd.append('file', form.file, form.file.name)
  fd.append('scope', form.scope)
  if (form.title?.trim()) fd.append('title', form.title.trim())
  if (form.book?.trim()) fd.append('book', form.book.trim())
  if (form.subjectId != null) fd.append('subjectId', String(form.subjectId))

  return request<RagDoc>('/ai/kb/documents', {
    rawBody: fd,
    timeoutMs: 300_000,
  })
}

export const listDocuments = (opts: {
  status?: DocStatus | ''
  beforeId?: number | null
  limit?: number
} = {}): Promise<RagDoc[]> => {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.beforeId != null) params.set('beforeId', String(opts.beforeId))
  params.set('limit', String(opts.limit ?? 20))
  return request<RagDoc[]>(`/ai/kb/documents?${params.toString()}`)
}

export const getDocument = (id: number): Promise<RagDoc> =>
  request<RagDoc>(`/ai/kb/documents/${id}`)

export const listChunks = (id: number): Promise<RagChunk[]> =>
  request<RagChunk[]>(`/ai/kb/documents/${id}/chunks`)

/** 重放：把还没进 ES 的切片补上，不需要重新上传原文件 */
export const reindexDocument = (id: number): Promise<RagDoc> =>
  request<RagDoc>(`/ai/kb/documents/${id}/reindex`, { method: 'POST', timeoutMs: 300_000 })

export const deleteDocument = (id: number): Promise<null> =>
  request<null>(`/ai/kb/documents/${id}`, { method: 'DELETE' })
