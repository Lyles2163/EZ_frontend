// 桌宠 iframe 集成测试：
// 1) 在深色宿主页里嵌入 iframe（与 EZ_frontend 的 PetWidget.vue 同样的样式），验证透明与遮挡；
// 2) 模拟鼠标拖拽宠物，验证拖拽是否生效。
import { createRequire } from 'node:module'

const require = createRequire('F:/AAAJAVA/code/pet/dsh-pet/dsh-pet/package.json')
const { chromium } = require('playwright')

const HOST_URL = 'http://127.0.0.1:5173/host-test.html'

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(HOST_URL, { waitUntil: 'load' })
const frame = page.frameLocator('iframe.pet')

// 等渲染器 boot
await page.waitForTimeout(4000)
const state = await page.evaluate(() => {
  const f = document.querySelector('iframe.pet')
  const w = f.contentWindow
  return {
    configOk: w.__dshPetDebug?.configOk,
    pos: w.__dshPetDebug?.dragPos,
    iframeBg: getComputedStyle(f).backgroundColor,
    bodyBg: getComputedStyle(w.document.body).backgroundColor,
    htmlBg: getComputedStyle(w.document.documentElement).backgroundColor,
  }
})
console.log('state:', JSON.stringify(state))
await page.screenshot({ path: 'pet-host-1.png' })

// 找到宠物 hit 元素在宿主页里的坐标并拖拽
const hit = frame.locator('.pet-hit')
const box = await hit.boundingBox()
console.log('hit box:', JSON.stringify(box))
if (box) {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx - i * 40, cy + i * 30)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(1000)
  const after = await page.evaluate(() => {
    const w = document.querySelector('iframe.pet').contentWindow
    return { pos: w.__dshPetDebug?.dragPos, release: w.__dshPetDebug?.lastDragRelease }
  })
  console.log('after drag:', JSON.stringify(after))
  await page.screenshot({ path: 'pet-host-2.png' })
}

await browser.close()
