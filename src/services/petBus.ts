/**
 * 桌宠事件总线：让业务 composable（useChat / useDrill）与 PetWidget 解耦。
 *
 * composable 只负责 emit 事件（"我做完了某件事"），
 * PetWidget 监听后决定要不要让宠物说话 / 播动画。
 * 这样业务逻辑不依赖 iframe 是否存在，也方便单测。
 */
import type { BroadcastOptions, WorkState } from './petApi'

type Handler = (...args: unknown[]) => void

class PetBus {
  private handlers = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const h of set) {
      try {
        h(...args)
      } catch {
        // 监听器报错不影响其他监听器和业务流程
      }
    }
  }
}

export const petBus = new PetBus()

/* ─── 业务事件定义 ─── */

/** AI 对话开始生成。 */
export function emitChatThinking(): void {
  petBus.emit('chat:thinking')
}

/** AI 对话完成（成功）。 */
export function emitChatDone(): void {
  petBus.emit('chat:done')
}

/** AI 对话失败。 */
export function emitChatError(msg: string): void {
  petBus.emit('chat:error', msg)
}

/** 做题答对。 */
export function emitAnswerCorrect(): void {
  petBus.emit('answer:correct')
}

/** 做题答错。 */
export function emitAnswerWrong(): void {
  petBus.emit('answer:wrong')
}

/** 做题提交（等待结果）。 */
export function emitAnswerSubmitting(): void {
  petBus.emit('answer:submitting')
}

/** 让宠物说一句话（任意业务直接调用）。 */
export function emitSay(text: string, opts?: BroadcastOptions): void {
  petBus.emit('say', text, opts)
}

/** 设置工作状态。 */
export function emitWorkStatus(state: WorkState, task?: string): void {
  petBus.emit('work-status', state, task)
}
