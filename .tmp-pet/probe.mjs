import { createRequire } from 'node:module'
const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.waitForTimeout(5000)
const frame = page.frame({ url: /PetWidget\/index\.html$/ })
console.log('frame found:', !!frame)
const info = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet-widget')
  const r = f.getBoundingClientRect()
  return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, cs: getComputedStyle(f).backgroundColor,
           appBg: getComputedStyle(document.body).backgroundColor }
})
console.log('host iframe:', JSON.stringify(info))
const finfo = await frame.evaluate(() => {
  const d = document
  return {
    htmlBg: getComputedStyle(d.documentElement).backgroundColor,
    bodyBg: getComputedStyle(d.body).backgroundColor,
    colorScheme: getComputedStyle(d.documentElement).colorScheme,
    inner: { w: innerWidth, h: innerHeight },
    sprites: (typeof sprites !== "undefined") ? sprites.map(s => ({ id: s.pet.id, size: s.size, pos: s.pos, margin: s.margin, winW: s.size + s.margin.l + s.margin.r, winH: s.winH + s.margin.t + s.margin.b })) : null,
    view: (typeof VIEW !== "undefined") ? { ...VIEW } : null,
    elBox: (() => { const e = d.querySelector(".pet-sprite"); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })(),
    hitBox: (() => { const e = d.querySelector(".pet-hit"); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, pe: getComputedStyle(e).pointerEvents } })(),
    videoSrc: [...d.querySelectorAll("video")].map(v => ({ src: (v.currentSrc||v.src).slice(-40), rs: v.readyState, front: v.classList.contains("is-front"), w: v.videoWidth, h: v.videoHeight })),
  }
})
console.log('pet page:', JSON.stringify(finfo, null, 1))
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/before-full.png' })
await page.screenshot({ path: 'F:/AAAJAVA/code/EZ_frontend/.tmp-pet/before-corner.png', clip: { x: 1440-560, y: 0, width: 560, height: 500 } })
await browser.close()
