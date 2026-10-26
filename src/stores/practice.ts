// src/stores/practice.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

const SUBJECT_KEY = 'practice:subjectId'

/** 从存储原串还原科目 id。任何不合法形态都回 null，让调用方退回"第一个科目"。 */
export function readStoredSubject(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function read(): string | null {
  // Node（测试环境）里 localStorage 是未声明的标识符，取它本身就抛 ReferenceError ——
  // 必须发生在 try 块内才接得住，写成 `typeof localStorage` 判断也一样，但这里跟 auth store 保持同一形态
  try {
    return localStorage.getItem(SUBJECT_KEY)
  } catch {
    return null
  }
}

function write(id: number): void {
  try {
    localStorage.setItem(SUBJECT_KEY, String(id))
  } catch {
    /* 隐私模式或配额：内存态仍然正确，本次会话不受影响（照 auth store 的处理） */
  }
}

/**
 * 只有一个字段：正在看哪一科。跨页（练习/错题本/收藏本）都要它，
 * 而题目、答题卡、分页这些一律留在页面里 —— 进 store 就是第二份真相。
 */
export const usePracticeStore = defineStore('practice', () => {
  const currentSubjectId = ref<number | null>(readStoredSubject(read()))

  function setSubject(id: number): void {
    currentSubjectId.value = id
    write(id)
  }

  return { currentSubjectId, setSubject }
})
