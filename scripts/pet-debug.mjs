// 桌宠渲染页调试脚本：加载 /PetWidget/index.html，打印控制台/页面错误并截图。
// 用法：node scripts/pet-debug.mjs [页面URL]
import { createRequire } from 'node:module'

const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const url = process.argv[2] ?? 'http://127.0.0.1:5173/PetWidget/index.html'
const vw = Number(process.argv[3] ?? 520)
const vh = Number(process.argv[4] ?? 480)

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: vw, height: vh } })

page.on('console', (msg) => console.log(`[console.${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) =>
  console.log(`[requestfailed] ${req.url()} -> ${req.failure()?.errorText}`),
)
page.on('response', (res) => {
  if (res.status() >= 400) console.log(`[http ${res.status()}] ${res.url()}`)
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(4000)

const debug = await page.evaluate(() => ({
  configOk: window.__dshPetDebug?.configOk,
  spriteCount: window.__dshPetDebug?.spriteCount,
  errors: window.__dshPetDebug?.errors ?? [],
  lastBubbleTitle: window.__dshPetDebug?.lastBubbleTitle,
  dragPos: window.__dshPetDebug?.dragPos,
  inner: { w: innerWidth, h: innerHeight },
  view: typeof VIEW === 'undefined' ? null : { ...VIEW },
  sprites: typeof sprites === 'undefined' ? null : sprites.map((s) => ({
    id: s.pet?.id,
    size: s.size,
    pos: s.pos,
    anim: s.anim,
  })),
  videoSrcs: [...document.querySelectorAll('video')].map((v) => ({
    src: v.currentSrc || v.src,
    readyState: v.readyState,
    networkState: v.networkState,
    error: v.error?.message ?? null,
    width: v.videoWidth,
    height: v.videoHeight,
    paused: v.paused,
  })),
  rootHTML: document.getElementById('root')?.innerHTML.slice(0, 400),
  errorBar: document.getElementById('pet-error')?.textContent,
}))

console.log('\n===== DEBUG STATE =====')
console.log(JSON.stringify(debug, null, 2))

await page.screenshot({ path: 'pet-debug.png' })
console.log('\nscreenshot -> pet-debug.png')
await browser.close()
