// src/stores/__tests__/practice.spec.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredSubject, usePracticeStore } from '../practice'

describe('readStoredSubject：localStorage 里的值不可信', () => {
  it('正常值', () => expect(readStoredSubject('2')).toBe(2))
  it('脏值一律 null', () => {
    expect(readStoredSubject(null)).toBeNull()
    expect(readStoredSubject('')).toBeNull()
    expect(readStoredSubject('abc')).toBeNull()
    // 0 会被原样带上 /practice/question/page，后端回 40400 —— 不如在这里就回落"第一科"
    expect(readStoredSubject('0')).toBeNull()
    expect(readStoredSubject('-3')).toBeNull()
    expect(readStoredSubject('1.5')).toBeNull()
    expect(readStoredSubject('NaN')).toBeNull()
    expect(readStoredSubject('Infinity')).toBeNull()
    expect(readStoredSubject('2 次')).toBeNull()
  })
})

describe('usePracticeStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('node 环境没有 localStorage：初始化与写入都不许崩', () => {
    const store = usePracticeStore()
    expect(store.currentSubjectId).toBeNull()
    expect(() => store.setSubject(1)).not.toThrow()
    expect(store.currentSubjectId).toBe(1)
  })

  it('多处取到的是同一个 store 实例（Layout 与 Drill 共用一个当前科目）', () => {
    const a = usePracticeStore()
    a.setSubject(2)
    expect(usePracticeStore().currentSubjectId).toBe(2)
  })

  it('换科目是覆盖而不是并存', () => {
    const store = usePracticeStore()
    store.setSubject(1)
    store.setSubject(2)
    expect(store.currentSubjectId).toBe(2)
  })
})
