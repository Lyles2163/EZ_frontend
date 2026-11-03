<script setup lang="ts">
/**
 * 桌宠挂件：用 iframe 嵌入 dsh-pet 的浏览器渲染页（public/PetWidget），
 * 渲染页内部通过 vite 代理 /pet -> dsh-pet 独立模式服务调用 HTTP API，
 * 并监听 petBus 事件，在业务节点让宠物说话 / 播动画 / 切换工作状态。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import * as pet from '../services/petApi'
import { petBus } from '../services/petBus'
import type { WorkState } from '../services/petApi'

const props = withDefaults(defineProps<{
  /** 默认宠物 id。dsh-pet 默认配置里是 "main"。 */
  petId?: string
  /** iframe 地址，默认走 dev 代理。 */
  src?: string
}>(), {
  petId: 'main',
  src: '/PetWidget/index.html',
})

const ready = ref(false)
const frameRef = ref<HTMLIFrameElement | null>(null)

function onLoad(): void {
  ready.value = true
}

type BubbleOptions = Omit<import('../services/petApi').BroadcastOptions, 'text'>

/* ─── 对外暴露的联动方法 ─── */

async function say(text: string, opts: BubbleOptions = {}): Promise<void> {
  if (!ready.value) return
  await pet.say(props.petId, text, opts)
}

async function playAnimation(name: string, facing?: 'left' | 'right'): Promise<void> {
  if (!ready.value) return
  await pet.playAnimation(props.petId, name, facing)
}

async function sayWithAnim(text: string, animName: string, opts: BubbleOptions = {}): Promise<void> {
  if (!ready.value) return
  await pet.sayWithAnim(props.petId, text, animName, opts)
}

async function setWorkStatus(state: WorkState, task?: string): Promise<void> {
  if (!ready.value) return
  await pet.setWorkStatus(state, task)
}

async function clearWorkStatus(): Promise<void> {
  if (!ready.value) return
  await pet.clearWorkStatus()
}

defineExpose({
  say,
  playAnimation,
  sayWithAnim,
  setWorkStatus,
  clearWorkStatus,
})

/* ─── 点击穿透：整屏 iframe 只在光标落到宠物（或它自己的浮层）上时才接管鼠标 ─── */

/** 渲染页报上来的「需要鼠标的矩形」，视口坐标 —— iframe 铺满视口，故与宿主 clientX/Y 同系 */
let rects: Array<{ x: number; y: number; width: number; height: number }> = []
/** 宠物正握着输入：拖拽中、右键菜单/对话/待办开着 —— 这段时间整窗保持接管 */
let busy = false
let hovering = false

function setPointerMode(auto: boolean): void {
  const f = frameRef.value
  if (!f) return
  const next = auto ? 'auto' : 'none'
  if (f.style.pointerEvents !== next) f.style.pointerEvents = next
}

function onWindowMove(e: MouseEvent): void {
  if (busy) return setPointerMode(true)
  hovering = rects.some(
    (r) => e.clientX >= r.x && e.clientX <= r.x + r.width && e.clientY >= r.y && e.clientY <= r.y + r.height,
  )
  setPointerMode(hovering)
}

/**
 * 渲染页报来的状态。rects = 需要鼠标的矩形（宠物命中盒 + 它的菜单/对话/待办），
 * busy = 它正握着输入（拖拽中、浮层开着），hover = 光标在不在这些矩形里。
 *
 * 交接是双向的：整窗穿透时宿主自己按 rects 判「该不该把鼠标给出去」；一旦给出去，
 * 子文档就吞掉 mousemove，宿主再也收不到移动事件，收回只能听渲染页报的 hover。
 */
function onPetMessage(ev: MessageEvent): void {
  const d = ev.data as { source?: string; busy?: boolean; hover?: boolean; rects?: typeof rects } | null
  if (!d || d.source !== 'dsh-pet') return
  if (Array.isArray(d.rects)) rects = d.rects
  if (typeof d.busy === 'boolean') busy = d.busy
  if (typeof d.hover === 'boolean') hovering = d.hover // 覆盖宿主那份陈旧值
  setPointerMode(busy || hovering)
}

/* ─── 监听业务事件 ─── */

const offs: Array<() => void> = []

onMounted(() => {
  window.addEventListener('mousemove', onWindowMove, true)
  window.addEventListener('message', onPetMessage)
  offs.push(
    petBus.on('chat:thinking', () => {
      void setWorkStatus('thinking')
    }),
    petBus.on('chat:done', () => {
      void setWorkStatus('success')
      // AI 回复完成时让宠物点评一句
      void say('回答完啦，主人看看满意不~', { duration: 6000 })
    }),
    petBus.on('chat:error', (msg) => {
      void setWorkStatus('error')
      void say(`哎呀出错了：${String(msg).slice(0, 30)}`, { duration: 6000 })
    }),
    petBus.on('answer:submitting', () => {
      void setWorkStatus('working', '判题中...')
    }),
    petBus.on('answer:correct', () => {
      void setWorkStatus('success')
      // 答对：播开心动画 + 鼓励气泡
      void sayWithAnim('答对啦！主人真棒~', '点击回应-开心跃动', { duration: 5000 })
    }),
    petBus.on('answer:wrong', () => {
      void setWorkStatus('error')
      // 答错：播沮丧动画 + 安慰气泡
      void sayWithAnim('没关系，再看看解析~', '工作状态-垂头叹气冒汗', { duration: 5000 })
    }),
    petBus.on('say', (text, opts) => {
      void say(String(text), opts as BubbleOptions | undefined)
    }),
    petBus.on('work-status', (state, task) => {
      void setWorkStatus(state as WorkState, task as string | undefined)
    }),
  )
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onWindowMove, true)
  window.removeEventListener('message', onPetMessage)
  for (const off of offs) off()
  offs.length = 0
  void pet.clearWorkStatus().catch(() => undefined)
})
</script>

<template>
  <iframe
    ref="frameRef"
    :src="src"
    class="pet-widget"
    frameborder="0"
    allow="autoplay; fullscreen"
    @load="onLoad"
  />
</template>

<style scoped>
.pet-widget {
  /* 整屏活动区：iframe 视口就是桌宠的「屏幕」，宠物在里面角落定位、走位漫游、拖到任意位置。
     空白处不拦点击，接管/交还见下面的 onWindowMove 与 onPetMessage。 */
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  /* 宿主页 [data-theme=dark] 的 color-scheme 会继承到 iframe 元素上；子文档是 normal 时
     Chromium 会把整块画布刷成不透明白（实测 frame=dark + child=normal → #fff，其余组合都透明）。
     钉成 normal 才真透明，浅色主题下同样不受影响。 */
  color-scheme: normal;
  border: none;
  z-index: 9999;
  /* 默认整窗穿透：iframe 元素只要可命中，它盖住的区域就拿不到宿主页的点击（子文档 body 关掉
     pointer-events 也只是把事件退回 iframe 元素本身）。光标进宠物矩形时由 onWindowMove 翻成 auto。 */
  pointer-events: none;
}
</style>
