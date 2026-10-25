// src/components/AI/streamMarkdown.ts
/**
 * 流式 Markdown 的两个纯函数。之所以能从 .vue 里拆出来：它们不碰 DOM、不需要 window，
 * 于是能用 node --test 直接证伪（DOMPurify 本体要 window，测不了）。
 */

// 围栏必须**在行首**才算块级围栏；行内 `code` 与两三个反引号的碎串不参与计数。
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/gm

/**
 * 奇数个围栏时补一个闭合围栏，偶数时原样。
 * 补的是与最后一个开围栏同字符同长度的串 —— 用 ``` 开的块补 ~~~ 等于没闭合。
 */
export function closeOpenFence(src: string): string {
  const fences = src.match(FENCE)
  if (!fences || fences.length % 2 === 0) return src
  return `${src}\n${fences[fences.length - 1].trim()}`
}

/**
 * 给所有带 target 的 <a> 补 rel=noopener，防 tabnabbing（spec §5.4 的硬要求）。
 * 写成纯字符串处理而不是 DOMPurify hook：hook 需要 window，在 Node 里就跑不到，
 * 而这条规则恰恰需要一条能跑的用例。
 */
export function decorateLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (tag, attrs: string) => {
    if (!/\btarget\s*=/i.test(attrs)) return tag
    if (/\brel\s*=\s*"[^"]*noopener[^"]*"/i.test(attrs)) return tag
    const kept = attrs.replace(/\brel\s*=\s*"[^"]*"/gi, '')
    return `<a${kept} rel="noopener noreferrer">`
  })
}
