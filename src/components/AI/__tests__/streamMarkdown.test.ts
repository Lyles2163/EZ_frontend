import test from 'node:test'
import assert from 'node:assert/strict'
import { closeOpenFence, decorateLinks } from '../streamMarkdown.ts'

test('奇数个围栏时补一个闭合围栏，偶数时原样', () => {
  assert.equal(closeOpenFence('abc'), 'abc')
  assert.equal(closeOpenFence('a\n```java\ncode'), 'a\n```java\ncode\n```')
  assert.equal(closeOpenFence('a\n```\nx\n```'), 'a\n```\nx\n```', '已闭合的不能再补')
  assert.equal(closeOpenFence('```a\n```b\n```c'), '```a\n```b\n```c\n```', '三个围栏 → 最后一个未闭合')
})

test('行内反引号不算围栏；四反引号包三反引号按 FENCE 实际匹配结果补齐', () => {
  assert.equal(closeOpenFence('用 `code` 说明'), '用 `code` 说明')
  // FENCE 只认行首且 `{3,}` 贪婪 → 这三行匹配到 ```` / ``` / ```` 共 3 个 → 奇数 → 补最后一个串。
  // 已知取舍：流式期间多包一次围栏只影响瞬时外观，done 之后用原文重解析定稿。
  assert.equal(closeOpenFence('```` 外层\n``` 内层\n````'), '```` 外层\n``` 内层\n````\n````')
})

test('补出来的围栏一定在行首，且与开围栏同字符同长度', () => {
  assert.ok(closeOpenFence('x\n```y').endsWith('\n```'))
  assert.equal(closeOpenFence('x\n~~~sh'), 'x\n~~~sh\n~~~', '波浪号围栏要补波浪号')
})

test('两个计数规则各自能被证伪：行中出现的不算，行内奇数个反引号也不算', () => {
  // 去掉 FENCE 的 ^ 锚定 → 这条会变成「1 个围栏 → 补齐」，从而红。
  assert.equal(closeOpenFence('行首不是围栏 ```x'), '行首不是围栏 ```x')
  // 把 {3,} 放宽成 {1,} 且不看锚定 → 这里 3 个反引号串 → 补齐，从而红。
  assert.equal(closeOpenFence('说 `a` 与 `b` 都行'), '说 `a` 与 `b` 都行')
  // 光有 ^ 锚定守不住 {3,}：行首恰好是行内代码时，放宽成 {1,} 会数出 1 个「围栏」。
  assert.equal(closeOpenFence('`a` 行首就是行内代码'), '`a` 行首就是行内代码')
})

test('decorateLinks：有 target 才补 rel，已有 noopener 的不重复补', () => {
  assert.equal(
    decorateLinks('<a href="https://x.dev" target="_blank">x</a>'),
    '<a href="https://x.dev" target="_blank" rel="noopener noreferrer">x</a>'
  )
  assert.equal(
    decorateLinks('<a href="https://x.dev" rel="noopener" target="_blank">x</a>'),
    '<a href="https://x.dev" rel="noopener" target="_blank">x</a>'
  )
  assert.equal(decorateLinks('<a href="https://x.dev">x</a>'), '<a href="https://x.dev">x</a>', '没有 target 就不该动它')
})
