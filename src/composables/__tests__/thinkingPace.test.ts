import test from 'node:test'
import assert from 'node:assert/strict'
import { nextPumpDelay } from '../thinkingPace.ts'

test('队列只有一条时按基准间隔放', () => {
  assert.equal(nextPumpDelay(1), 220)
  assert.equal(nextPumpDelay(0), 220)
})

test('积压越多放得越快：间隔按 base/(len-1) 收缩', () => {
  assert.equal(nextPumpDelay(2), 220)
  assert.equal(nextPumpDelay(3), 110)
  assert.equal(nextPumpDelay(6), 44)
  assert.equal(nextPumpDelay(12), 40, '12 条时算出 20ms，但被下限抬回 40')
})

test('不低于下限，也不高于基准', () => {
  assert.equal(nextPumpDelay(100), 40)
  assert.equal(nextPumpDelay(1, 300, 50), 300)
  assert.equal(nextPumpDelay(7, 300, 50), 50, '300/6=50 正好落在下限')
  assert.equal(nextPumpDelay(20, 300, 50), 50)
})

test('非正数的 base/min 不会放出一个 0 或 NaN 的延时', () => {
  assert.equal(nextPumpDelay(3, 0, 0), 0, 'base=0 → 立刻放，这是调用方要的语义')
  assert.equal(nextPumpDelay(3, 220, -5), 110)
  assert.equal(Number.isFinite(nextPumpDelay(3, NaN, NaN)), false, 'NaN 传进来就照实 NaN，不静默兜成基准')
})
