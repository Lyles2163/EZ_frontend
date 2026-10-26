// src/api/practice/__tests__/errors.spec.ts
import { describe, expect, it } from 'vitest'
import { AuthError, BizError, HttpError } from '../../request'
import { errorText } from '../errors'

describe('errorText：语义唯一的码用固定文案，一模多义的码用后端中文', () => {
  it('40000 展示后端 msg（多义，映射表会把原因丢掉）', () => {
    expect(errorText(new BizError('subjectId 与 questionId 只能给一个', 40000)))
      .toBe('subjectId 与 questionId 只能给一个')
    expect(errorText(new BizError('答题模式只能是 1顺序 或 3智能练习', 40000)))
      .toBe('答题模式只能是 1顺序 或 3智能练习')
  })

  it('40900 展示后端 msg（题目已下架 / 科目已停用 / 该记录已完成自评 三义）', () => {
    expect(errorText(new BizError('题目已下架', 40900))).toBe('题目已下架')
    expect(errorText(new BizError('该记录已完成自评', 40900))).toBe('该记录已完成自评')
  })

  it('40100 / 40300 / 40400 用固定文案', () => {
    expect(errorText(new BizError('用户身份不存在，请重新登录', 40100))).toBe('登录状态异常，请重新登录')
    expect(errorText(new BizError('无权操作该作答', 40300))).toBe('无权操作该作答')
    // 科目 / 题目 / 作答记录 三种缺失在后端共用一个码，前端分辨不出来，只能给一句诚实的话
    expect(errorText(new BizError('科目不存在', 40400))).toBe('内容可能已更新，请刷新重试')
    expect(errorText(new BizError('作答记录不存在', 40400))).toBe('内容可能已更新，请刷新重试')
  })

  it('未知码回落后端 msg，msg 空再回落到带码的通用文案', () => {
    expect(errorText(new BizError('别的说法', 49999))).toBe('别的说法')
    expect(errorText(new BizError('', 49999))).toBe('操作失败（49999）')
  })

  it('AuthError 不渲染：跳登录由 request.ts 的收口负责', () => {
    expect(errorText(new AuthError('登录状态已失效', 401))).toBeNull()
    expect(errorText(new AuthError('没有权限', 403))).toBeNull()
  })

  it('HttpError 原样给文案（网关没起是最常见的真实故障，这句原话要留着）', () => {
    expect(errorText(new HttpError('无法连接服务器，请确认网关已启动', 0)))
      .toBe('无法连接服务器，请确认网关已启动')
    expect(errorText(new HttpError('请求超时，请稍后重试', 0))).toBe('请求超时，请稍后重试')
    expect(errorText(new HttpError('GET /practice/subject/list 响应格式异常：name 期望字符串', 0)))
      .toContain('subject/list')
  })

  it('不是三种 Error 的东西也不崩', () => {
    expect(errorText('字符串')).toBe('出现了未预期的问题，请稍后重试')
    expect(errorText(undefined)).toBe('出现了未预期的问题，请稍后重试')
    expect(errorText(new Error('原生错误'))).toBe('出现了未预期的问题，请稍后重试')
  })
})
