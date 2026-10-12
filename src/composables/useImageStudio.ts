import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  deleteRecords,
  fetchRecords,
  submitGeneration,
  uploadReference,
  type GenerationRecord,
  type ImageQuality,
  type ReferenceImage
} from '../api/image'

const POLL_MS = 800

export interface GenerateFormState {
  prompt: string
  model: string
  quality: ImageQuality
  size: string
  count: number
  alignTo16: boolean
  references: ReferenceImage[]
}

const emptyForm = (): GenerateFormState => ({
  prompt: '',
  model: 'gpt-image-2',
  quality: 'auto',
  size: '1:1',
  count: 1,
  alignTo16: true,
  references: []
})

export function useImageStudio() {
  const records = ref<GenerationRecord[]>([])
  const loading = ref(true)
  const submitting = ref(false)
  const error = ref('')

  const activeId = ref<string>('')
  const checkedIds = ref<string[]>([])

  const form = reactive<GenerateFormState>(emptyForm())

  const activeRecord = computed(
      () => records.value.find(item => item.id === activeId.value) ?? null
  )
  const allChecked = computed(
      () => records.value.length > 0 && checkedIds.value.length === records.value.length
  )
  const hasRunningTask = computed(() =>
      records.value.some(item => item.status === 'queued' || item.status === 'running')
  )

  let timer: ReturnType<typeof setInterval> | null = null

  const stopPolling = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const startPolling = () => {
    if (timer !== null || !hasRunningTask.value) return
    timer = setInterval(async () => {
      try {
        records.value = await fetchRecords()
        if (!hasRunningTask.value) stopPolling()
      } catch (err) {
        error.value = err instanceof Error ? err.message : '刷新生成记录失败'
        stopPolling()
      }
    }, POLL_MS)
  }

  const reload = async () => {
    loading.value = true
    error.value = ''
    try {
      records.value = await fetchRecords()
      if (activeId.value && !records.value.some(item => item.id === activeId.value)) {
        activeId.value = ''
      }
      if (!activeId.value) activeId.value = records.value[0]?.id ?? ''
      checkedIds.value = checkedIds.value.filter(id => records.value.some(item => item.id === id))
      startPolling()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载生成记录失败'
    } finally {
      loading.value = false
    }
  }

  const selectRecord = (id: string) => {
    activeId.value = id
  }

  const toggleChecked = (id: string) => {
    const at = checkedIds.value.indexOf(id)
    if (at === -1) checkedIds.value.push(id)
    else checkedIds.value.splice(at, 1)
  }

  const toggleCheckedAll = () => {
    checkedIds.value = allChecked.value ? [] : records.value.map(item => item.id)
  }

  const removeChecked = async () => {
    const ids = [...checkedIds.value]
    if (ids.length === 0) return
    try {
      await deleteRecords(ids)
      checkedIds.value = []
      await reload()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除失败'
    }
  }

  const resetForm = () => {
    // 只重置文本与选项，参考图的 objectURL 交给 unmount 统一回收
    Object.assign(form, emptyForm(), { references: form.references })
    activeId.value = ''
  }

  const attachFiles = async (files: File[]) => {
    const images = files.filter(file => file.type.startsWith('image/'))
    if (images.length === 0) return
    try {
      const uploaded = await Promise.all(images.map(file => uploadReference(file)))
      form.references.push(...uploaded)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '参考图上传失败'
    }
  }

  const removeReference = (id: string) => {
    const at = form.references.findIndex(item => item.id === id)
    if (at === -1) return
    const [removed] = form.references.splice(at, 1)
    URL.revokeObjectURL(removed.url)
  }

  const generate = async () => {
    if (!form.prompt.trim() || submitting.value) return
    submitting.value = true
    error.value = ''
    try {
      const created = await submitGeneration({
        prompt: form.prompt.trim(),
        model: form.model,
        quality: form.quality,
        size: form.size,
        count: form.count,
        alignTo16: form.alignTo16,
        references: form.references.map(item => item.url)
      })
      await reload()
      activeId.value = created.id
    } catch (err) {
      error.value = err instanceof Error ? err.message : '提交生成任务失败'
    } finally {
      submitting.value = false
    }
  }

  onMounted(reload)

  onUnmounted(() => {
    stopPolling()
    form.references.forEach(item => URL.revokeObjectURL(item.url))
  })

  return {
    records, loading, submitting, error,
    activeId, activeRecord, checkedIds, allChecked,
    form,
    reload, selectRecord, toggleChecked, toggleCheckedAll, removeChecked,
    resetForm, attachFiles, removeReference, generate
  }
}
