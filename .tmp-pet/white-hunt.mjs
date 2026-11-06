// 定位「白色方块」到底由谁绘制：在 /ai（暗色）下遍历 iframe 内所有元素，
// 列出背景非透明的元素及其矩形；同时遍历宿主页落在 iframe 矩形内的元素。
import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } })
await page.goto('http://127.0.0.1:5173/ai', { waitUntil: 'load' })
await page.waitForTimeout(6000)
const theme = await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark'
  return getComputedStyle(document.documentElement).backgroundColor
})
console.log('host html bg (dark):', theme)
await page.waitForTimeout(1200)

const inner = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  const fr = f.getBoundingClientRect()
  const doc = f.contentDocument
  const out = []
  const walk = (el) => {
    const cs = getComputedStyle(el)
    const bg = cs.backgroundColor
    const img = cs.backgroundImage
    const m = /rgba?\(([^)]+)\)/.exec(bg)
    const opaque = m ? !(m[1].split(',').map((s) => s.trim())[3] === '0' || m[1].trim() === '0, 0, 0, 0') : bg !== 'transparent'
    if ((opaque || (img && img !== 'none')) && el.getBoundingClientRect().width > 0) {
      const r = el.getBoundingClientRect()
      out.push({ tag: el.tagName, cls: String(el.className.baseVal ?? el.className).slice(0, 60), bg, img: img.slice(0, 40), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], pe: cs.pointerEvents })
    }
    for (const c of el.children) walk(c)
  }
  walk(doc.documentElement)
  return {
    frame: { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height) },
    frameColorScheme: getComputedStyle(f).colorScheme,
    innerColorScheme: getComputedStyle(doc.documentElement).colorScheme,
    bodyBg: getComputedStyle(doc.body).backgroundColor,
    htmlBg: getComputedStyle(doc.documentElement).backgroundColor,
    painted: out,
  }
})
console.log(JSON.stringify(inner, null, 1))

// 宿主页：iframe 矩形内、z 序在它下面的元素背景
const host = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  const r = f.getBoundingClientRect()
  f.style.visibility = 'hidden'
  const samples = []
  for (const [dx, dy] of [[10, 10], [260, 230], [500, 440]]) {
    const el = document.elementFromPoint(r.x + dx, r.y + dy)
    if (el) {
      const cs = getComputedStyle(el)
      samples.push({ tag: el.tagName, cls: String(el.className.baseVal ?? el.className).slice(0, 50), bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 50) })
    }
  }
  f.style.visibility = 'visible'
  return samples
})
console.log('host behind frame:', JSON.stringify(host, null, 1))
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/white-hunt.png' })
await browser.close()
