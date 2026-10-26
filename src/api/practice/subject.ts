// src/api/practice/subject.ts
import { request } from '../request'
import { parseSubjectList, type SubjectItem } from './types'

/** data 是裸数组（不是 PageVO）—— 科目只有几科，后端一次给全 */
export async function fetchSubjects(): Promise<SubjectItem[]> {
  return parseSubjectList(await request<unknown>('/practice/subject/list'))
}
