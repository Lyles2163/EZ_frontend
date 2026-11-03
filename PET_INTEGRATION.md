# dsh-pet 桌宠集成说明

在 EZ_frontend 项目中集成 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 桌面宠物，
通过 **iframe 嵌入独立模式 + HTTP API 控制** 实现与业务联动。

## 架构

```
┌─────────────────────────────────────────┐
│  EZ_frontend (Vue3 + Vite)              │
│                                         │
│  PetWidget.vue (iframe)                 │
│      │ 嵌入 http://127.0.0.1:3080/...   │
│      ▼                                  │
│  ┌─────────────────────────────────┐    │
│  │  dsh-pet 独立模式 (Node 进程)    │    │
│  │  http://127.0.0.1:3080          │    │
│  │  └─ /dsh-pet-7340/*  HTTP API   │    │
│  └─────────────────────────────────┘    │
│      ▲                                  │
│      │ fetch (走 vite /pet 代理)        │
│  petApi.ts ──┐                          │
│              │ emit                     │
│  petBus.ts ◄─┘                          │
│      ▲                                  │
│      │ emit 事件                        │
│  useChat / useDrill (业务 composable)   │
└─────────────────────────────────────────┘
```

## 启动步骤

### 1. 启动 dsh-pet 独立模式

```bash
# 全局安装（只需一次）
npm install -g dsh-pet

# 启动独立模式服务（默认端口 3080）
dsh-pet-standalone
```

启动后会看到：

```
===== dsh-pet 独立模式（不需要 DSH）=====
  路由        http://127.0.0.1:3080/dsh-pet-7340/
```

### 2. 启动前端项目

```bash
npm run dev
```

打开 `http://localhost:5173`，桌宠铺满整个页面（透明覆盖层），默认停在窗口右下角。

## 覆盖层：透明与点击穿透

桌宠是一层铺满视口的 iframe，靠三条约定做到「看得见、拖得动、但不挡应用」：

1. **白底**：宿主页 `[data-theme=dark]` 的 `color-scheme` 会继承到 iframe 元素上，子文档是
   `normal` 时 Chromium 会把整块画布刷成不透明白。`PetWidget.vue` 里把 iframe 钉成
   `color-scheme: normal` 才是真透明（实测矩阵：frame=dark × child=normal 是唯一出白格的组合）。
2. **交出去**：iframe 元素默认 `pointer-events: none`。整窗只要可命中，它盖住的区域就拿不到宿主页的
   点击（子文档 body 关掉 pointer-events 也只是把事件退回 iframe 元素本身）。宿主按渲染页报来的
   矩形判光标是否落在宠物身上，落上了才翻成 `auto`。
3. **收回来**：翻成 `auto` 后子文档会吞掉 mousemove，宿主再也收不到移动事件，所以收回的时机只能由
   渲染页报 `hover:false`（`sprite/input.js` 的 `reportHover`）。拖拽/菜单/对话开着时报 `busy:true`，
   宿主保持接管不撒手。

`public/PetWidget/` 是 `dsh-pet/runtime/electron-helper` 的一份拷贝，浏览器模式（`IS_BROWSER_MODE`）
的分支都收在这份拷贝里：几何取 iframe 视口、API 走 vite 代理、鼠标接管权上报。上游重新拷贝时这几处
要一起带过去。

## 联动点

| 业务场景 | 触发时机 | 宠物反应 |
|---------|---------|---------|
| AI 对话 | 发送消息 | 工作状态 → 「思考」 |
| AI 对话 | 回复完成 | 工作状态 → 「成功」+ 气泡「回答完啦，主人看看满意不~」 |
| AI 对话 | 回复失败 | 工作状态 → 「出错」+ 气泡提示错误 |
| 做题 | 提交答案 | 工作状态 → 「工作中」+ task「判题中...」 |
| 做题 | 答对 | 工作状态 → 「成功」+ 开心动画 + 鼓励气泡 |
| 做题 | 答错 | 工作状态 → 「出错」+ 沮丧动画 + 安慰气泡 |

## 文件清单

| 文件 | 作用 |
|-----|------|
| `src/services/petApi.ts` | dsh-pet HTTP API 客户端封装（锁、说话、动画、工作状态、待办） |
| `src/services/petBus.ts` | 事件总线：业务 composable emit，PetWidget 监听 |
| `src/components/PetWidget.vue` | iframe 嵌入组件，监听事件并调用 petApi |
| `src/composables/useChat.ts` | 接入：发送/完成/失败时 emit 事件 |
| `src/composables/useDrill.ts` | 接入：提交/答对/答错时 emit 事件 |
| `vite.config.ts` | dev 代理：`/pet` → `http://127.0.0.1:3080` |
| `src/App.vue` | 挂载 PetWidget |

## API 速查

独立模式下 `POST /whisper`、`POST /chat`、`POST /balance` 不可用
（没有 DSH 的模型凭据），但以下接口可用：

| 接口 | 用途 |
|-----|------|
| `POST /lock?pet=` | 取占用锁，独占这只宠物 |
| `POST /broadcast?pet=&lock=` | 让它说指定的话（需锁） |
| `POST /anim?pet=&lock=` | 点播动画（需锁，动画名=素材文件名） |
| `POST /work-status` | 设置工作状态（thinking/working/success/error 等） |
| `DELETE /work-status` | 清空工作状态 |
| `POST /todos` | 新建待办 |
| `POST /sleep?pet=` / `POST /wake?pet=` | 睡下 / 叫醒 |

完整契约见 `F:\AAAJAVA\code\pet\dsh-pet\openapi.yaml`。

## 自定义联动

在任意业务代码中，通过 petBus 发射事件即可：

```ts
import { emitSay, emitWorkStatus } from '../services/petBus'

// 让宠物说一句话
emitSay('主人，该休息一下啦~')

// 设置工作状态
emitWorkStatus('working', '生成报告中...')
```

或者直接用 petApi（需要确保 iframe 已加载）：

```ts
import { sayWithAnim } from '../services/petApi'

await sayWithAnim('main', '完成啦！', 'gongzuozhuangtai-queyue-qingzhu')
```

## 动画名

动画名即 `dsh-pet/assets/webm/` 下的文件名（去扩展名），例如：

- `dianji-huiying-kaixin-yuedong` — 点击回应-开心跃动
- `gongzuozhuangtai-chuitou-tanqi-maohan` — 工作状态-垂头叹气冒汗
- `gongzuozhuangtai-queyue-qingzhu` — 工作状态-雀跃庆祝
- `chi-baifan` — 吃白饭
- `yuandi-zhuanxin-wan-mofang` — 原地专心玩魔方

完整列表见右键菜单「动作」或 `dsh-pet/assets/config.jsonc`。
