<script setup lang="ts">
/**
 * 知识库管理页。替换掉原先写死假数据的占位页。
 *
 * 样式只用 AI/Layout.vue 定义的那套变量（--sb-bg / --text / --text-muted / --border /
 * --sb-hover / --sb-active / --main-bg）。Practice 模块的 --divider / --text-secondary /
 * --primary-500 在本模块不存在，用了就是透明色，属于不会报错但看不见的 bug。
 *
 * 上传刻意用原生 <input type="file">：拖拽要处理 dragenter/dragover/dragleave 的计数器
 * （子元素进出会误触发 leave），对一个内部功能页不值得。accept 只限制选择器，
 * 真正的白名单校验在后端 rag.ingest.allowed-extensions。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import FolderFloat, { type FolderFloatItem } from '../../components/AI/FolderFloat.vue'
import { useRagKb } from '../../composables/useRagKb'
import { useTheme } from '../../composables/useTheme'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  validateFile,
  type DocStatus,
  type RagDoc,
} from '../../api/ragKb'
import { formatDateTime } from '../../utils/datetime'

const kb = useRagKb()
const theme = useTheme()

// ---- 文件夹视图：按 book 字段分组 ----
//
// 后端 RagDoc 已有 book（书名/课程名）字段，天然就是文件夹分组键：
// 有 book 的归到对应文件夹，没有的放进「未分组」。
// 后端目前没有独立的 folder 表，这里纯前端分组，加库时只需把数据源换成
// /ai/kb/folders 即可，视图层不用改。
interface FolderGroup {
  name: string
  docs: RagDoc[]
}

const UNGROUPED = '未分组'

/** 同一个 folder 里文档多时，每片只露首行并截断，避免物理模拟区域被撑爆 */
const LABEL_MAX = 18
const ellipsisLabel = (s: string) => (s.length > LABEL_MAX ? s.slice(0, LABEL_MAX - 1) + '…' : s)

/** 每个文件夹最多展示这么多便签。
 *  matter-js 每个便签是一个刚体，超过 30 个会掉帧；同时多行便签会撑高上方净空。
 *  多出来的用一个「+N 更多」占位点开滚到列表，不进物理模拟。 */
const MAX_ITEMS_PER_FOLDER = 15

const folders = computed<FolderGroup[]>(() => {
  const map = new Map<string, RagDoc[]>()
  for (const d of kb.docs.value) {
    const key = d.book?.trim() || UNGROUPED
    const arr = map.get(key)
    if (arr) arr.push(d)
    else map.set(key, [d])
  }
  return [...map.entries()].map(([name, docs]) => ({ name, docs }))
})

/** 便签数量受限：超过上限的归并成一个「+N 更多」占位，value 用 '__more__' 前缀。 */
function buildItems(docs: RagDoc[]): FolderFloatItem[] {
  const head = docs.slice(0, MAX_ITEMS_PER_FOLDER)
  const items: FolderFloatItem[] = head.map(d => ({
    label: ellipsisLabel(d.title || d.fileName),
    value: String(d.id),
  }))
  const more = docs.length - head.length
  if (more > 0) items.push({ label: `+${more} 更多`, value: '__more__' })
  return items
}

/** spread 控制单行能放多少便签。文档多就放宽，避免堆太多行。 */
function spreadOf(docs: RagDoc[]): number {
  const n = Math.min(docs.length, MAX_ITEMS_PER_FOLDER)
  // 每个便签约 90px + gap，n=1 时给 160，线性到 n=15 时 360
  return Math.max(160, Math.min(360, 140 + n * 16))
}

/** 行高来自 FolderFloat.vue 里的 ROW=52，便签向上铺，每多一行就要多留一份净空。 */
const maxRowsAcrossFolders = computed(() => {
  let max = 1
  for (const f of folders.value) {
    const shown = Math.min(f.docs.length, MAX_ITEMS_PER_FOLDER)
    // spread 一行大约能放 spread/90 个，向上取整
    const perRow = Math.max(1, Math.floor(spreadOf(f.docs) / 90))
    max = Math.max(max, Math.ceil(shown / perRow))
  }
  return max
})

// 点文件夹里的便签：定位到那条文档并展开切片。
// 列表是按 id 降序，展开后滚到该行，否则折叠在下面用户看不到。
const listRef = ref<HTMLElement | null>(null)
async function pickDoc(value: string): Promise<void> {
  // 「+N 更多」占位：没有具体文档，滚到列表区即可
  if (value === '__more__') {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  const id = Number(value)
  if (!Number.isFinite(id)) return
  await kb.toggleChunks(id)
  await nextTick()
  const el = listRef.value?.querySelector<HTMLElement>(`[data-doc-id="${id}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// 主题色：FolderFloat 要一套 folder/paper/item 配色，跟随 Layout 的明暗变量。
const folderPalette = computed(() => {
  const dark = theme.value === 'dark'
  return dark
    ? {
        folderColor: '#27272a',
        frontColor: '#3f3f46',
        paperColor: '#18181b',
        itemColor: '#f4f4f5',
        itemTextColor: '#18181b',
        labelColor: '#fafafa',
      }
    : {
        folderColor: '#3f3f46',
        frontColor: '#52525b',
        paperColor: '#f5f5f5',
        itemColor: '#f5f5f5',
        itemTextColor: '#18181b',
        labelColor: '#f5f5f5',
      }
})

// ---- 本地示例数据（仅前端演示，不写后端）----
//
// 后端还没数据 / 没填 book 时，文件夹视图看不到。这里塞几条带 book 的假文档进
// kb.docs，纯本地演示 FolderFloat 效果，刷新页面就没了。id 用负数避免和真数据冲突。
let sampleSeq = -1000
function makeSampleDoc(over: Partial<RagDoc>): RagDoc {
  const now = Date.now()
  return {
    id: sampleSeq--,
    fileName: 'sample.md',
    title: '示例文档',
    book: null,
    scope: 'personal',
    ownerName: '我',
    subjectId: 0,
    mimeType: 'text/markdown',
    fileSize: 4096,
    status: 'indexed',
    chunkCount: 12,
    tokenCount: 1800,
    errorMsg: null,
    createTime: now,
    updateTime: now,
    ...over,
  }
}

const SAMPLE_DOCS: RagDoc[] = [
  makeSampleDoc({ id: -1001, fileName: 'ds-overview.md', title: '数据结构概览', book: '《数据结构》', chunkCount: 8, tokenCount: 1200 }),
  makeSampleDoc({ id: -1002, fileName: 'ds-binary-tree.md', title: '二叉树与遍历', book: '《数据结构》', chunkCount: 15, tokenCount: 2400 }),
  makeSampleDoc({ id: -1003, fileName: 'ds-graph.md', title: '图的存储与遍历', book: '《数据结构》', chunkCount: 11, tokenCount: 1900 }),
  makeSampleDoc({ id: -1008, fileName: 'ds-linked-list.md', title: '链表操作', book: '《数据结构》', chunkCount: 6, tokenCount: 900 }),
  makeSampleDoc({ id: -1009, fileName: 'ds-stack-queue.md', title: '栈与队列', book: '《数据结构》', chunkCount: 7, tokenCount: 1000 }),
  makeSampleDoc({ id: -1010, fileName: 'ds-sort.md', title: '排序算法对比', book: '《数据结构》', chunkCount: 12, tokenCount: 1800 }),
  makeSampleDoc({ id: -1011, fileName: 'ds-search.md', title: '查找与哈希', book: '《数据结构》', chunkCount: 9, tokenCount: 1400 }),
  makeSampleDoc({ id: -1012, fileName: 'ds-heap.md', title: '堆与优先队列', book: '《数据结构》', chunkCount: 8, tokenCount: 1200 }),
  makeSampleDoc({ id: -1013, fileName: 'ds-avl.md', title: 'AVL 平衡树', book: '《数据结构》', chunkCount: 10, tokenCount: 1600 }),
  makeSampleDoc({ id: -1014, fileName: 'ds-b-tree.md', title: 'B 树与 B+ 树', book: '《数据结构》', chunkCount: 11, tokenCount: 1700 }),
  makeSampleDoc({ id: -1015, fileName: 'ds-trie.md', title: '字典树', book: '《数据结构》', chunkCount: 6, tokenCount: 800 }),
  makeSampleDoc({ id: -1016, fileName: 'ds-union-find.md', title: '并查集', book: '《数据结构》', chunkCount: 5, tokenCount: 700 }),
  makeSampleDoc({ id: -1017, fileName: 'ds-string-match.md', title: '字符串匹配', book: '《数据结构》', chunkCount: 9, tokenCount: 1300 }),
  makeSampleDoc({ id: -1018, fileName: 'ds-red-black.md', title: '红黑树', book: '《数据结构》', chunkCount: 13, tokenCount: 2000 }),
  makeSampleDoc({ id: -1019, fileName: 'ds-skip-list.md', title: '跳表', book: '《数据结构》', chunkCount: 7, tokenCount: 1100 }),
  makeSampleDoc({ id: -1020, fileName: 'ds-bloom.md', title: '布隆过滤器', book: '《数据结构》', chunkCount: 4, tokenCount: 600 }),
  makeSampleDoc({ id: -1021, fileName: 'ds-lsm.md', title: 'LSM 树', book: '《数据结构》', chunkCount: 10, tokenCount: 1500 }),
  makeSampleDoc({ id: -1004, fileName: 'os-scheduling.md', title: '进程调度算法', book: '《操作系统》', chunkCount: 9, tokenCount: 1500 }),
  makeSampleDoc({ id: -1005, fileName: 'os-memory.md', title: '虚拟内存与分页', book: '《操作系统》', chunkCount: 13, tokenCount: 2100 }),
  makeSampleDoc({ id: -1006, fileName: 'cn-tcp.md', title: 'TCP 三次握手与四次挥手', book: '《计算机网络》', chunkCount: 7, tokenCount: 1100 }),
  makeSampleDoc({ id: -1007, fileName: 'misc-note.md', title: '零散笔记（无书名）', book: null, chunkCount: 3, tokenCount: 500 }),
]

function seedSamples(): void {
  // 已经有示例数据就不再重复加
  if (kb.docs.value.some(d => d.id < 0)) return
  kb.docs.value = [...SAMPLE_DOCS, ...kb.docs.value]
  kb.notice.value = '已注入本地示例文档（刷新后消失），点文件夹查看效果'
}

// ---- 上传表单 ----
const picked = ref<File | null>(null)
const pickError = ref<string | null>(null)
const scope = ref<'personal' | 'official'>('personal')
const book = ref('')
const title = ref('')

/** accept 属性：限制系统选择器只显示可上传的类型 */
const acceptAttr = computed(() => ALLOWED_EXTENSIONS.map(e => `.${e}`).join(','))

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  picked.value = file
  pickError.value = file ? validateFile(file) : null
  // 清 input 的 value：否则选同一个文件第二次不触发 change，用户以为点了没反应
  input.value = ''
}

function clearPick(): void {
  picked.value = null
  pickError.value = null
}

async function submit(): Promise<void> {
  const file = picked.value
  if (!file || kb.uploading.value) return
  const bad = validateFile(file)
  if (bad) {
    pickError.value = bad
    return
  }
  const ok = await kb.upload({
    file,
    scope: scope.value,
    title: title.value || undefined,
    book: book.value || undefined,
  })
  if (ok) {
    picked.value = null
    title.value = ''
    book.value = ''
  }
}

// ---- 状态展示 ----
const STATUS_LABEL: Record<DocStatus, string> = {
  pending: '待处理',
  parsing: '解析中',
  chunking: '切片中',
  embedding: '向量化中',
  indexed: '已入库',
  failed: '失败',
}

const FILTERS: Array<{ value: DocStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'indexed', label: '已入库' },
  { value: 'failed', label: '失败' },
  { value: 'embedding', label: '处理中' },
]

function statusLabel(s: DocStatus): string {
  return STATUS_LABEL[s] ?? s
}

/** 能否重放：入库失败的、或一片都没进 ES 的才需要；已成功的重放是空跑 */
function canReindex(d: RagDoc): boolean {
  return d.status === 'failed' || d.status === 'embedding' || d.chunkCount === 0
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function onDelete(d: RagDoc): Promise<void> {
  // 删除会连带清掉检索索引里的切片，不可逆，必须二次确认
  const label = d.title || d.fileName
  const ok = window.confirm(
    `删除「${label}」？\n\n会同时清掉它在检索索引里的 ${d.chunkCount} 个切片，不可恢复。`
  )
  if (!ok) return
  await kb.remove(d.id)
}

onMounted(async () => {
  await kb.reload()
  // 后端没数据时自动注入示例，方便直接看到文件夹效果；刷新会消失。
  if (kb.docs.value.length === 0) seedSamples()
})
</script>

<template>
  <section class="kb">
    <header class="head">
      <div class="head-text">
        <h1 class="title">知识库</h1>
        <p class="desc">
          上传的文档会切片、向量化并写入检索索引；对话时开启「知识库增强（RAG）」即可引用这些资料并看到出处。
          目前支持 {{ ALLOWED_EXTENSIONS.join(' / ') }}，单文件不超过 {{ MAX_FILE_BYTES / 1024 / 1024 }}MB。
        </p>
      </div>
      <div class="head-actions">
        <button class="ghost" type="button" @click="seedSamples">生成示例</button>
        <button class="ghost" type="button" :disabled="kb.loading.value" @click="kb.reload()">
          {{ kb.loading.value ? '加载中…' : '刷新' }}
        </button>
      </div>
    </header>

    <!-- ============ 上传区 ============ -->
    <form class="upload" @submit.prevent="submit">
      <div class="pick-row">
        <label class="pick">
          <input type="file" :accept="acceptAttr" :disabled="kb.uploading.value" @change="onPick" />
          <span>{{ picked ? picked.name : '选择文件' }}</span>
        </label>
        <button v-if="picked" class="ghost" type="button" @click="clearPick">清除</button>
        <span v-if="picked" class="size">{{ formatSize(picked.size) }}</span>
      </div>

      <p v-if="pickError" class="pick-error">{{ pickError }}</p>

      <div class="fields">
        <label class="field">
          <span class="field-label">归属</span>
          <select v-model="scope" :disabled="kb.uploading.value">
            <option value="personal">个人库（仅自己可见）</option>
            <option value="official">官方库（所有人可见，需管理员）</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">书名 / 课程名</span>
          <input v-model="book" type="text" placeholder="选填，如《数据结构》" :disabled="kb.uploading.value" />
        </label>
        <label class="field">
          <span class="field-label">标题</span>
          <input v-model="title" type="text" placeholder="选填，默认取正文首行" :disabled="kb.uploading.value" />
        </label>
      </div>

      <div class="submit-row">
        <button class="primary" type="submit" :disabled="!picked || !!pickError || kb.uploading.value">
          {{ kb.uploading.value ? '入库中，请稍候…' : '上传并入库' }}
        </button>
        <span v-if="kb.uploading.value" class="hint">要向量化全部切片，文件大时可能需要几十秒</span>
      </div>
    </form>

    <ErrorBar v-if="kb.error.value" :message="kb.error.value" @dismiss="kb.error.value = null" />

    <div v-if="kb.notice.value" class="notice" role="status">
      <span>{{ kb.notice.value }}</span>
      <button class="notice-x" type="button" aria-label="关闭提示" @click="kb.notice.value = null">×</button>
    </div>

    <!-- ============ 筛选 ============ -->
    <div class="filters">
      <button
        v-for="f in FILTERS"
        :key="f.value || 'all'"
        class="chip"
        type="button"
        :data-active="kb.statusFilter.value === f.value ? '' : undefined"
        @click="kb.setStatusFilter(f.value)"
      >{{ f.label }}</button>
    </div>

    <!-- ============ 文件夹视图 ============ -->
    <!-- 按 book 分组的文件夹：click 打开，便签可拖拽，点便签跳转到对应文档。
         只要有文档就展示，没填 book 的归到「未分组」文件夹。
         每个文件夹最多 15 个便签，多了显示「+N 更多」。 -->
    <div v-if="folders.length" class="folders">
      <p class="folders-title">按书 / 课程分组</p>
      <div
        class="folder-grid"
        :style="{ paddingTop: `${60 + maxRowsAcrossFolders * 52}px` }"
      >
        <FolderFloat
          v-for="f in folders"
          :key="f.name"
          :label="f.name"
          :items="buildItems(f.docs)"
          trigger="click"
          :close-on-select="false"
          :spread="spreadOf(f.docs)"
          :folder-color="folderPalette.folderColor"
          :front-color="folderPalette.frontColor"
          :paper-color="folderPalette.paperColor"
          :item-color="folderPalette.itemColor"
          :item-text-color="folderPalette.itemTextColor"
          :label-color="folderPalette.labelColor"
          @select="pickDoc"
        />
      </div>
    </div>

    <!-- ============ 列表 ============ -->
    <EmptyState
      v-if="!kb.loading.value && kb.docs.value.length === 0"
      title="还没有文档"
      :hint="kb.statusFilter.value
        ? '当前筛选条件下没有文档，换个条件试试。'
        : '上传一份 txt 或 Markdown，几分钟就能在对话里引用它。'"
    />

    <ul v-else ref="listRef" class="list">
      <li v-for="d in kb.docs.value" :key="d.id" class="row" :data-doc-id="d.id">
        <div class="main-col">
          <p class="line1">
            <span class="badge" :data-status="d.status">{{ statusLabel(d.status) }}</span>
            <span>{{ d.scope === 'official' ? '官方库' : '个人库' }}</span>
            <span v-if="d.book" class="ellipsis">{{ d.book }}</span>
          </p>
          <p class="name">{{ d.title || d.fileName }}</p>
          <p class="meta">
            {{ d.fileName }} · {{ formatSize(d.fileSize) }}
            · {{ d.chunkCount }} 片 / {{ d.tokenCount }} tokens
            · {{ formatDateTime(d.updateTime) }}
          </p>
          <p v-if="d.status === 'failed' && d.errorMsg" class="fail-reason">{{ d.errorMsg }}</p>
        </div>

        <div class="acts">
          <button class="ghost" type="button" @click="kb.toggleChunks(d.id)">
            {{ kb.expandedId.value === d.id ? '收起切片' : '查看切片' }}
          </button>
          <button v-if="canReindex(d)" class="ghost" type="button" @click="kb.reindex(d.id)">重放</button>
          <button class="danger" type="button" @click="onDelete(d)">删除</button>
        </div>

        <!-- 切片明细：排查「为什么这段话没被检索到」时看这里 -->
        <div v-if="kb.expandedId.value === d.id" class="chunks">
          <p v-if="kb.chunksLoading.value" class="chunks-note">加载中…</p>
          <template v-else>
            <div v-for="c in kb.chunksOf.value" :key="c.id" class="chunk">
              <p class="chunk-head">
                <span class="chunk-seq">#{{ c.seq }}</span>
                <span class="chunk-status" :data-status="c.indexStatus">{{ c.indexStatus }}</span>
                <span>{{ c.tokenCount ?? 0 }} tokens</span>
                <span v-if="c.pageNo">第 {{ c.pageNo }} 页</span>
              </p>
              <p v-if="c.chapterPath" class="chunk-path">{{ c.chapterPath }}</p>
              <pre class="chunk-body">{{ c.content }}</pre>
            </div>
            <p v-if="kb.chunksOf.value.length === 0" class="chunks-note">没有切片</p>
          </template>
        </div>
      </li>
    </ul>

    <footer v-if="kb.docs.value.length" class="pager">
      <button class="ghost" type="button" :disabled="!kb.canPrev.value" @click="kb.goPrev()">上一页</button>
      <span class="page-no">第 {{ kb.pageNo.value }} 页</span>
      <button class="ghost" type="button" :disabled="!kb.canNext.value" @click="kb.goNext()">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.kb {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head, .upload, .filters, .folders, .list, .notice, .pager {
  max-width: 900px;
  margin-inline: auto;
  width: 100%;
}
.head { display: flex; align-items: flex-start; gap: 12px; }
.head-text { flex: 1; min-width: 0; }
.head-actions { display: flex; gap: 8px; flex: none; }
.title { margin: 0 0 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; color: var(--text); }
.desc { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-muted); }

.upload {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--sb-bg);
}
.pick-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pick {
  display: inline-flex; align-items: center;
  padding: 8px 14px; border: 1px dashed var(--border); border-radius: 9px;
  font-size: 13px; cursor: pointer; color: var(--text);
  min-width: 0; overflow: hidden;
}
.pick:hover { background: var(--sb-hover); }
.pick input { display: none; }
.pick span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px; }
.size { font-size: 12px; color: var(--text-muted); flex: none; }
.pick-error { margin: 0; font-size: 12px; color: #e5484d; }

.fields { display: flex; gap: 12px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
.field-label { font-size: 12px; color: var(--text-muted); }
.field select, .field input {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--main-bg); color: var(--text); font: inherit; font-size: 13px;
}
.submit-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hint { font-size: 12px; color: var(--text-muted); }

.notice {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, #30a46c 12%, transparent);
  border: 1px solid var(--border); color: var(--text);
}
.notice span { flex: 1; min-width: 0; }
.notice-x {
  flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font-size: 16px; line-height: 1; cursor: pointer;
}
.notice-x:hover { background: var(--sb-hover); }

.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  padding: 6px 13px; border: 1px solid var(--border); border-radius: 999px;
  background: transparent; color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer;
}
.chip:hover { background: var(--sb-hover); }
.chip[data-active] { background: var(--sb-active); color: var(--text); font-weight: 500; }

/* ===================== 文件夹视图 ===================== */
/* FolderFloat 的便签从文件夹顶部向上弹出（负 Y），必须给 grid 顶部留净空，
   否则第一行文件夹弹出的便签会被上方元素裁掉。120px 覆盖 lift+多行行高+spread。 */
.folders { display: flex; flex-direction: column; gap: 8px; }
.folders-title { margin: 4px 2px 0; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.folder-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 28px 36px;
  padding-bottom: 16px;
  align-items: flex-start;
}

.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--sb-bg);
}
.main-col { flex: 1; min-width: 0; }
.line1 {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 5px; font-size: 12px; color: var(--text-muted); min-width: 0;
}
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge {
  flex: none; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 500; background: var(--sb-active); color: var(--text);
}
.badge[data-status="indexed"] { background: color-mix(in srgb, #30a46c 20%, transparent); }
.badge[data-status="failed"] { background: color-mix(in srgb, #e5484d 20%, transparent); }
.badge[data-status="embedding"],
.badge[data-status="parsing"],
.badge[data-status="chunking"],
.badge[data-status="pending"] { background: color-mix(in srgb, #0091ff 20%, transparent); }
.name { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--text); }
.meta { margin: 0; font-size: 12px; color: var(--text-muted); }
.fail-reason {
  margin: 6px 0 0; padding: 6px 10px; border-radius: 8px; font-size: 12px;
  background: color-mix(in srgb, #e5484d 10%, transparent); color: var(--text);
}

.acts { display: flex; gap: 8px; flex: none; flex-wrap: wrap; }
.ghost, .primary, .danger {
  padding: 7px 13px; border-radius: 9px; font: inherit; font-size: 13px; cursor: pointer;
  border: 1px solid var(--border); background: transparent; color: var(--text);
}
.ghost:hover:not(:disabled), .primary:hover:not(:disabled) { background: var(--sb-hover); }
.primary { background: var(--sb-active); font-weight: 500; }
.danger { color: #e5484d; border-color: color-mix(in srgb, #e5484d 30%, transparent); }
.ghost:disabled, .primary:disabled { opacity: .5; cursor: default; }

.chunks {
  flex: 1 0 100%;
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 12px; border-top: 1px solid var(--border); min-width: 0;
}
.chunks-note { margin: 0; font-size: 12px; color: var(--text-muted); }
.chunk { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.chunk-head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 0; font-size: 11px; color: var(--text-muted);
}
.chunk-seq { font-weight: 600; color: var(--text); }
.chunk-status[data-status="indexed"] { color: #30a46c; }
.chunk-status[data-status="pending"],
.chunk-status[data-status="embedded"] { color: #0091ff; }
.chunk-status[data-status="failed"] { color: #e5484d; }
.chunk-path { margin: 0; font-size: 11px; color: var(--text-muted); }
.chunk-body {
  margin: 0; padding: 8px 10px; border-radius: 8px;
  background: var(--main-bg); border: 1px solid var(--border);
  color: var(--text); font-size: 12px; line-height: 1.6; font-family: inherit;
  white-space: pre-wrap; word-break: break-word;
  max-height: 160px; overflow-y: auto;
}

.pager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.page-no { font-size: 12px; color: var(--text-muted); }

@media (max-width: 767px) {
  .kb { padding: 16px 14px 32px; }
  .row { align-items: flex-start; }
  .acts { width: 100%; }
}
</style>
