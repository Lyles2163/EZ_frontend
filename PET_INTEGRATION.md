# dsh-pet 桌宠集成说明

在 EZ_frontend 项目中集成 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 桌面宠物，
通过 **iframe 嵌入独立模式 + HTTP API 控制** 实现与业务联动。

## 架构

```
┌─────────────────────────────────────────┐
│  EZ_frontend (Vue3 + Vite)              │
│                                         │
│  PetWidget.vue (iframe)                 │
│      │ 嵌入 /PetWidget/index.html       │
│      │  （public/ 下的渲染页副本）       │
│      ▼                                  │
│  ┌─────────────────────────────────┐    │
│  │  dsh-pet 独立模式 (Node 进程)    │    │
│  │  = 项目内 pet-server/，由 vite   │    │
│  │  插件随 dev server 起停          │    │
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

只有一步：`npm run dev`。桌宠独立模式由 vite 插件 `vite-plugins/petServer.ts` 跟着 dev server 一起起、一起收。

- 桌宠代码在项目内的 `pet-server/`（上游 dsh-pet 0.4.0，MIT，版权声明见 `pet-server/LICENSE`）。`node_modules` 与 67M 的 `assets/preview/`（运行时零引用的演示 GIF）不进 git；前者用 `npm install --prefix pet-server` 重建。
- 起进程时固定传 `--port 3080`，代理目标因此不会漂到别的端口。
- 运行清单 `~/.dsh/dsh-pet/standalone-runtime.json` 里的 pid 还活着 → 复用，不重复起；进程被强杀留下的陈旧清单按「没有实例」处理，直接重新拉起。
- 子进程的 stdout/stderr 加 `[pet]` 前缀打进 dev 日志，不用另开窗口盯。
- dev server 关闭时只杀自己拉起的那个 pid，并清掉指向自己的运行清单。实测用 `taskkill /F` 硬杀 dev server 也不会留孤儿进程。

已知边界：桌宠在 dev server 运行期间自己死掉，**不会自动重生**，要等下一次 `npm run dev`。

AI 配置（接口地址、模型、密钥）存在 `~/.dsh/dsh-pet/standalone-ai.json`，按用户主目录定位、与代码放在哪无关，所以换目录不需要重配。

令牌每次桌宠启动都会换，因此 `/pet` 代理在**每个请求上现读**运行清单，而不是启动时读死——否则桌宠一重启，前端这边就全程 403，只能连带重启 dev server。

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
| `vite.config.ts` | dev 代理：`/pet` → `http://127.0.0.1:3080`，令牌每请求现读 |
| `vite-plugins/petServer.ts` | 随 dev server 起停桌宠独立模式；运行清单解析与实例复用判定 |
| `vite-plugins/__tests__/petServer.test.ts` | 上面那个的 node 单测（清单解析、pid 存活、端口选择、缺依赖护栏） |
| `pet-server/` | dsh-pet 独立模式本体（MIT）；`node_modules` 与 `assets/preview` 不进 git |
| `src/App.vue` | 挂载 PetWidget |

## API 速查

独立模式没有 DSH 宿主，`POST /whisper`、`POST /balance` 不可用。
`POST /chat` **可用**——它经 `/ai/v1/chat/completions` 兼容层打到本项目自己的 AIModule
（DeepSeek + RAG），口径见后端仓库；凭据存在 `~/.dsh/dsh-pet/standalone-ai.json`。

以下控制接口可用：

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
