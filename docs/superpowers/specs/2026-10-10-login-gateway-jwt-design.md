# 登录页 + 网关/JWT 前端鉴权设计

日期：2026-10-10 · 范围：仅 `EZ_frontend`，后端 `ezPracticeExercises` 代码零改动

## 1. 背景与已确认决策

后端已有可用的 Spring Cloud Gateway + JWT 链路（网关 JWT 拦截器已测试通过）。本轮在前端建立第一套 HTTP 客户端与登录态，把 `SlideCommit.vue`、`CodeSlots.vue` 两个孤立组件接入。

| # | 决策 | 选定 |
|---|---|---|
| D1 | 边界 | 只做前端，适配现有网关 + JWT；后端问题只出清单不改 |
| D2 | `CodeSlots` 角色 | 占位验证码 + 预留 API 层（mock 函数体，签名不换） |
| D3 | JWT 存储 | 「记住我」开关：勾 → `localStorage`，不勾 → `sessionStorage` |
| D4 | 守卫范围 | 只保护 `/user` 与 `/ai/**`；`/practice`、`/community` 游客可看 |
| D5 | 注册 | 登录页内嵌「登录 / 注册」切换标签（后端两接口共用一个 DTO） |

传输层选型：**原生 `fetch`**，不引入 axios。理由——项目现为运行时零 HTTP 依赖（`package.json` 仅 vue/vue-router/pinia/hugeicons/motion-v/ogl）；且 `AI对话思考链路API设计文档.md:397` 已规定 SSE 必须用 `fetch` + `response.body.getReader()`，选 fetch 可让登录与 AI 流式共用一套客户端。

## 2. 后端契约事实（实现依据，均经代码核实）

### 2.1 端点

| 方法 | 路径 | 请求体 | 成功响应 | 需登录 |
|---|---|---|---|---|
| POST | `/auth/login` | `{username, password, captchaCode, captchaKey?}` | `data:{token,userName,iat,exp}` | 否（白名单） |
| POST | `/auth/register` | 同上一 DTO | `data:"注册成功"`（字符串落在 `data`，不在 `msg`） | 否（白名单） |
| POST | `/auth/logout` | 无体，读 `Authorization` 头 | — | 见 §9 第 2 条，**经网关必失败** |

- `AuthController.java:88-91` 的 `login` 复用 `RegisterRequest`，仓库内不存在 `LoginRequest`。
- 字段约束（`RegisterRequest.java:11-23`）：`username` `@NotBlank` + `@Size(4,20)` + `@Pattern(^[a-zA-Z0-9_]+$)`；`password` `@NotBlank` + `@Size(8,64)`；`captchaCode` `@NotBlank`；`captchaKey` 可选。
- 网关端口 8100，路由 `Path=/auth/** → lb://AuthModuleServer`、`Path=/user/** → lb://UserModuleServer`，**无 StripPrefix**，路径原样转发。路由块在本地 `application.yaml` 已被注释，实际来自 Nacos `gateway-module.yaml`。

### 2.2 令牌

- 请求头必须是 `Authorization: Bearer <jwt>`。`JwtAuthGlobalFilter.java:101-107` 严格 `startsWith("Bearer ")` 后 `substring(7)`：小写 `bearer ` 或缺空格 → 视为无令牌 → 401。
- Claims：`userId(Long)`、`username(String)`、`userRole(String，角色 id 的数字串，如 "1")`、`iat`、`exp`。**无 `sub`、无 `jti`、无 `iss/aud`**。
- 算法由密钥长度自动选定（当前 68 字节密钥 → HS512），前端解码时不要写死 `alg`。
- 有效期配置键 `leon.jwt.expiration`（**毫秒**），代码默认 86400000（24h），真值在 Nacos `common-jwt.yaml`。
- **不存在 refresh token、不存在 `/auth/refresh`**（全仓 grep 仅命中 Nacos `refreshEnabled` 与无人调用的 `AuthRedisService.refreshExpire`）。过期只能重新登录。
- 网关验签后：注入 `X-User-Name`（仅用户名），**并删除 `Authorization` 头**再转发。下游拿不到 `userId`，也没有任何角色/权限上下文（无 `LoginUser`/`UserContext`/`@PreAuthorize`，无自定义鉴权注解）。

### 2.3 响应体：三种形状必须归一

| 来源 | 形状 | HTTP | 判据 |
|---|---|---|---|
| `Result`（业务） | `{code:1\|0, msg, data}` | 200 | **成功 = `code === 1`**；密码错误也是 200 + `code:0` |
| 网关拦截器 | `{code:401, message:"缺少或无效的授权头"\|"无效或过期令牌"}` | 401 | 键是 `message` |
| AuthModule Security | `{code:401\|403, msg:"未登录或Token已过期"\|"权限不足"}` | 401/403 | 键是 `msg` |
| Boot 默认错误 | `{timestamp, path, status, error, requestId}` | 404/500/503… | 无 `code` |

实测样例（`.idea/httpRequests/`）：登录成功 `{"code":1,"msg":"success","data":{"userName":"test920","exp":"2026-09-30T00:23:27.000+00:00","iat":"…","token":"eyJ…"}}`；凭据错误 `{"code":0,"msg":"用户名或密码错误","data":null}`（**200**）。

`iat`/`exp` 实测序列化为 **ISO-8601 带 `+00:00` 的字符串**，而非 epoch 数字 → 类型按 `string | number` 收，再归一为毫秒。

## 3. 架构与文件划分

```
vite.config.ts                 [改] server.port 5173 + server.proxy：/gw → 127.0.0.1:8100（rewrite 去 /gw）
env.d.ts                       [改] ImportMetaEnv 增 VITE_API_BASE?: string
src/api/request.ts             [新] 唯一传输层：Bearer 注入、三种响应体归一、401 钩子、超时
src/api/auth.ts                [新] login/register/logout/fetchCaptcha/verifyCaptchaLocal（验证码为 mock）
src/stores/auth.ts             [新] 登录态与令牌生命周期，唯一持有者
src/composables/useLogin.ts    [新] 登录/注册表单态、校验、滑动提交编排、错误分支
src/views/Login.vue            [新] 页面：双标签 + 表单 + CodeSlots + SlideCommit
src/router/index.ts            [改] 加 /login 路由、meta.requiresAuth、beforeEach 守卫、401 收口注册
src/views/Header.vue           [改] 死按钮「登录」接跳转；已登录显示用户名 + 退出
src/views/AI/Layout.vue        [改] 同一死按钮接跳转（仅补 handler，不动配色重复）
src/components/login/*.vue     [不改] 通过 props 注入主题色与回调，内部零改动
```

每个单元的对外契约：`request.ts` 只暴露 `request<T>()` + 三个错误类 + `setTokenGetter()`/`setUnauthorizedHandler()` 两条注入通道；`auth.ts` 只暴露类型对齐 §2.1 的具名异步函数；`stores/auth.ts` 是唯一写令牌的主体，且**不 import router**；`useLogin.ts` 是唯一驱动两个登录组件状态的编排者；`Login.vue` 只做布局与 props/事件转发。

## 3.1 为什么是 `/gw` 前缀而不是直接代理 `/auth`、`/user`

直接代理 `/user`、`/ai` 会与前端路由同名（`router/index.ts` 已注册 `/user`、`/ai`、`/ai/images` 等），dev server 会把进页面的 HTML 导航请求转给网关，页面直接坏掉。故统一走 `/gw` 前缀，由 Vite rewrite 剥离后再进网关：

```
浏览器  /gw/auth/login  --Vite rewrite-->  网关  /auth/login  -->  AuthModuleServer:8103
```
网关侧 `Path=/auth/**` 与白名单 `startsWith("/auth/login")` 命中的都是 rewrite 之后的路径，行为不变。生产用 Nginx `location /gw/ { proxy_pass http://gateway:8100/; }` 保持同一形状。`baseURL` 取 `import.meta.env.VITE_API_BASE || '/gw'`。

## 3.2 不做的事（YAGNI）

不引入 axios / 校验库 / `pinia-plugin-persistedstate`（存储逻辑只有两处读写，直接写）；不做前端解密 JWT（`login` 响应已回 `exp`）；不做 token 自动续期（后端无该接口）；不做「角色→UI 元素」门禁（后端 `userRole` 从未被任何一层校验，且下游收不到角色）；不动 `design.md` 里过时的绿色 token 值；不重构 `Header.vue` 与 `AI/Layout.vue` 重复的 specular 配色对象（只在报告里标出）。

## 4. `src/api/request.ts`

```ts
export class BizError extends Error {}      // code === 0，携带 msg
export class AuthError extends Error {}     // 401 / 403
export class HttpError extends Error {}     // 其余状态码 / 网络错误 / 超时

export interface RequestOptions {
  body?: unknown
  method?: 'GET' | 'POST'                    // 缺省：有 body 即 POST
  auth?: boolean                            // 默认 true：带 Bearer
  envelope?: 'result' | 'none'              // 默认 'result'
}

export async function request<T>(path: string, opts?: RequestOptions): Promise<T>
export function setUnauthorizedHandler(fn: (reason: AuthError) => void): void
export function setTokenGetter(get: () => string | null): void
```

- 头：有体时 `Content-Type: application/json`；`auth !== false` 且 store 有 token 时 `` Authorization: `Bearer ${token}` ``（前缀由这一层统一拼，**调用方与存储层都只存裸 JWT**，杜绝双前缀）。不发 `withCredentials`——后端全程不用 Cookie。
- 成功判据 `res.ok && (envelope === 'none' || json.code === 1)`；`envelope === 'result'` 时返回 `json.data`，否则返回整个 body（`/user/selectAll` 是裸数组，必须能关信封）。
- `res.ok` 但 `code === 0` → `throw new BizError(json.msg)`，登录失败文案由此上屏。
- `res.status === 401 || 403` → `throw new AuthError(json.message ?? json.msg ?? '登录状态已失效')`，**先调用已注册的 unauthorized 钩子再抛**，保证清令牌不依赖调用方是否 catch。
- 非 2xx 且非 401/403 → `HttpError`，`message` 优先取 Boot 默认体的 `error`，兜底中文。
- 超时 `AbortSignal.timeout(15000)`，与调用方传入的 signal 合并（`AbortSignal.any` 不可用则退化为只用自己的）。
- 网络层抛错（代理目标未启动 → `TypeError: Failed to fetch`）统一转 `HttpError('无法连接服务器，请确认网关已启动')`，避免登录页只看到空白。
- 令牌读取走 `setTokenGetter` 注入的 `() => string | null`，401 走 `setUnauthorizedHandler`——两条反向通道都存在 `request.ts` 模块级变量里，**`request.ts` 不 import store**，防止循环依赖。

## 5. `src/api/auth.ts`

```ts
export type TimeValue = string | number        // 后端 iat/exp 实测为 ISO-8601 字符串，兼容 epoch 数字
export interface CredentialForm { username: string; password: string; captchaCode?: string; captchaKey?: string }
export interface LoginResult    { token: string; userName: string; iat: TimeValue; exp: TimeValue }
export interface CaptchaChallenge { captchaKey: string; challenge: string; kind: 'text' | 'image-base64' }
export function toMillis(v: TimeValue): number  // 两分支都非法时抛 HttpError，不返回 NaN

export function login(p: CredentialForm): Promise<LoginResult>      // POST /auth/login
export function register(p: CredentialForm): Promise<string>        // POST /auth/register → "注册成功"
export function logout(): Promise<void>                   // POST /auth/logout，令牌由 request 层注入，尽力而为
export function fetchCaptcha(): Promise<CaptchaChallenge>           // mock
export function verifyCaptchaLocal(code: string): boolean           // mock 专用，真后端上线即删
```

`fetchCaptcha` 的 mock：生成 6 位数字，存模块私有 `{ key, expected, expiresAt }`（TTL 5 分钟），`challenge` 直接回显数字串。真实后端接入时只替换 `fetchCaptcha` 函数体（改为返回图片/base64 与 `captchaKey`）、删掉 `verifyCaptchaLocal` 并让 `login` 的 `code:0` 承担验证码判错——UI 与调用点签名不动，符合既有「预留 API 层」约定。

诚实性约束：mock 阶段验证码是**纯客户端摆设**，不提供任何防暴力能力，UI 需在验证码区显示「开发占位」小标签，避免被误认为已具备防护。

`login` 里对 `data` 做窄校验（`token`/`userName` 存在且为 string），形状不符即抛 `HttpError('登录响应格式异常')`，避免把坏 token 存进 store。

## 6. `src/stores/auth.ts`

Setup store，命名 `useAuthStore`、id `auth`（对齐 `stores/counter.ts:4`）。

```ts
token: Ref<string | null>   userName: Ref<string>   exp: Ref<number>   remember: Ref<boolean>
isLoggedIn: ComputedRef<boolean>          // !!token && exp > Date.now()
login(p: CredentialForm & { remember?: boolean }): Promise<void>
logout(): Promise<void>   clear(): void
// 同文件另导出：resolveRedirect(raw: unknown): string
```

- 落盘单键 `ez-auth`，值 `{ token, userName, exp, remember }`。**store 创建时同步水合**，不放 `onMounted`（与 `App.vue:11-16` 主题预读同理，否则 `beforeEach` 先判未登录跳走，再水合回来，出现闪跳）。
- `remember` 决定落 `localStorage` 还是 `sessionStorage`；水合时按存储的 `remember` 选桶。若两桶都有值，取 `exp` 更晚者并清掉另一个，防止旧标签页的过期值覆盖新登录态。
- 存的是**裸 JWT**，`Bearer ` 前缀只在 §4 拼装一次。
- 水合阶段即丢弃已过期记录（清桶），使 `isLoggedIn` 首次求值就是终态。
- 令牌读取走注入通道：store 创建时调 `setTokenGetter(() => token.value)`，**`request.ts` 不 import store**。
- **401 的处理器不在 store 里注册**——store 若 import `router` 会和 `router/index.ts` import store 形成循环。改由 `router/index.ts` 注册（见 §7），store 只暴露 `clear()`。
- `login()`：调 §5 `login` → `toMillis(data.exp)` → 写状态 + 落盘。**不跳转、不 import router**，导航由页面负责。
- `logout()`：**无论后端返回什么都 `clear()`**；后端调用放 catch 里吞掉的 `Promise`（见 §9 第 2 条已知失效）。
- `onUnmounted` 无需清理——store 与应用同生命周期。
- 过期不设定时器：`isLoggedIn` 每次求值比较 `exp`，配合守卫与 401 钩子已覆盖，不引入额外计时器。

## 7. 路由守卫

`router/index.ts` 现为纯路由表、无任何守卫。新增：

```ts
{ path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { title: '登录' } }
// /user 与 /ai 两个节点加 meta: { requiresAuth: true }，/ai 的 children 继承父级 meta
```

```ts
router.beforeEach((to) => {
  const auth = useAuthStore()            // 必须在回调内取：main.ts:12-13 先 pinia 后 router，模块顶层取会崩
  const needs = to.matched.some(r => r.meta.requiresAuth)
  if (needs && !auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.path === '/login' && auth.isLoggedIn) {
    const target = resolveRedirect(to.query.redirect)
    return target === '/login' ? { path: '/practice' } : { path: target }
  }
})
```

`resolveRedirect(raw: unknown): string` 定义在 `src/stores/auth.ts` 并导出（唯一持有者），守卫与 `useLogin` 都调它，避免两处各写一份校验：非 string、不以 `/` 开头、以 `//` 开头（协议相对 → 跳出站内）、或指向 `/login` 自身时，一律回落 `'/practice'`。这是防开放重定向的**唯一**关卡，登录成功后的跳转不得绕过它直接 `router.replace(query.redirect)`。

`/` → `/practice` 的现有重定向保持不变。

401 收口也放在本文件（它能同时拿到 `router` 与 store，不构成循环）：路由表定义之后注册

```ts
setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  if (!auth.token) return                       // 已清过，避免连环弹跳
  auth.clear()
  const from = router.currentRoute.value.fullPath
  if (router.currentRoute.value.path !== '/login') {
    void router.replace({ path: '/login', query: { redirect: from } })
  }
})
```

`App.vue` 无全局错误处理，因此任何请求（含 AI 模块后续接口）撞到 401/403 都由这一处集中清态并跳登录，调用方是否 `catch` 不影响清令牌（§4 保证钩子先于抛出执行）。

## 8. 登录页与两个组件的接线

### 8.1 结构

`Login.vue` 单文件居中玻璃卡片（复用 `App.vue:63-127` 的 `--glass-*` / `--primary-*` / `--text-*` token，**不用** AI 模块局部的 `--sb-*`），自上而下：

1. 品牌标题 + 副标题（中文文案，与业务层一致；AI 模块保留英文属孤例）
2. 标签切换 `登录 / 注册`
3. 用户名、密码（原生 `<input v-model>`，项目无 `<form>`/原生校验用法）
4. 仅登录标签：「记住我」复选框（决定 D3 的存储桶）
5. 仅登录标签：验证码行（`获取验证码` 按钮 + 60s 冷却）+ `CodeSlots`
6. `SlideCommit` 滑动提交
7. 错误横幅 `<p class="banner">`（`rgba(239,68,68,.12)` 底 + `#dc2626`，与 `Images.vue:87-94` 同款）
8. 底部互补标签链接

### 8.2 `useLogin.ts` 编排（状态形态对齐 `composables/useImageStudio.ts:35-38`）

```ts
tab: Ref<'login' | 'register'>   form: Reactive<CredentialForm>   captcha: Ref<CaptchaChallenge | null>
captchaStatus: Ref<'idle'|'error'|'success'>   remember: Ref<boolean>   submitting / cooldown / error
canSubmit / submit(): Promise<void>   requestCode(): Promise<void>
```

- 校验手写（项目无校验库）：`username` `^[a-zA-Z0-9_]{4,20}$`、`password` 长度 8-64。后端 `@Valid` 因缺 `spring-boot-starter-validation` **实际不生效**，这两条只能在前端兜住。
- `CodeSlots` 已把非数字过滤干净（`digitsOf`），故只需校验 `length === 6`；未满 6 位时 `error` 提示且不进滑动提交。`verifyCaptchaLocal` 失败 → `captchaStatus='error'`（组件自动抖动清空），成功 → `'success'`（洗白打勾）。
- `submit` 作为 `SlideCommit` 的 `onConfirm` 传入：组件 `await` 该 Promise，pending 自动转圈、成功 `done`、失败 `error` + 抖动复位——**登录页无需自己维护按钮动画状态**。内部先 `!canSubmit() || submitting` 早退（防重入），成功后 `authStore.login({ ...form, remember: remember.value })` → `router.replace(resolveRedirect(route.query.redirect))`。
- `register` 成功 → 提示「注册成功」并自动切回登录标签、回填用户名。用户名重复当前后端无异常处理器，落 500 + Boot 默认体 → 走 `HttpError` 通用文案。
- 两个组件默认深色（`SlideCommit` `trackColor:'#262626'`、`CodeSlots` `slotColor:'#27272a'`），用 `useTheme()` 只读取当前主题后按主题传色值 props，组件内部零改动。

### 8.3 入口

`Header.vue:122-142` 的「登录」`SpecularButton` 现在无 `@click`、无 `router-link`（点了没反应）。补跳转 `/login`；`isLoggedIn` 时改为显示 `userName` chip + 退出按钮。`AI/Layout.vue:53-70` 同一按钮同样补 handler。

## 9. 后端必修清单（本轮不改，留给你排期）

1. **CORS 全缺**：全仓 grep 无 `CrossOrigin|CorsWebFilter|globalcors`。生产要么给网关加 `spring.cloud.gateway.globalcors`，要么由 Nginx 同源转发（本设计的 `/gw` 已按后者形状准备）。且 `OPTIONS` 不在白名单，预检会被 JWT 过滤器先 401。
2. **登出经网关必失败**：`/auth/logout` 在白名单里被注释（`JwtAuthGlobalFilter.java:43-48`）→ 要求带令牌；网关又删除 `Authorization` 后才转发（`:78-81`）→ `AuthController.java:99` 永远收到 `null`，实测恒返 `{"code":0,"msg":"未携带token"}`。
3. **直连登出会 500**：`AuthServiceImpl.java:85-90` 读 `claims.getSubject()`，而 `JwtUtil.createToken` 从不 `subject()` → `Long.valueOf(null)` 抛 NPE，且 `catch` 只捕 `NumberFormatException`，Redis 清理永不执行。
4. **令牌吊销无效**：网关无 Redis、无黑名单，只验签 + `exp`；吊销前的令牌到期前始终可用。
5. **`@Valid` 形同虚设**：AuthModule 只引 `jakarta.validation-api`，无 Hibernate Validator，实测 6 位密码且不带 `captchaCode` 的登录照样 200 出票。
6. **无全局异常处理器**：全仓零 `@RestControllerAdvice`，重复用户名 → 500 裸奔。
7. **TTL 分裂**：`JwtConfig.expiration` 默认 24h 用于签发 JWT，`AuthServiceImpl.java:34` 的 `${leon.jwt.expiration:7200000}` 默认 2h 用于 Redis 记录，Nacos 未显式配置时两者不一致。
8. **`/practice/**`、`/ai/**` 路由只存在于 Nacos**，仓库不可证；接这两块前先在 Nacos 控制台核对。
9. **下游只有用户名**：网关注入 `X-User-Name`，无 `userId`/角色头，任何需要 id 的接口须自带 username→id 查询。

## 10. 验证计划

1. `npm run build`（含 `vue-tsc` 类型检查）——项目级门槛，既有无关报错一并修（既有约定）。
2. `npm run dev`（5173）+ 浏览器实测：未登录访问 `/ai` → 跳 `/login?redirect=/ai`；验证码取码 / 6 位门槛 / 错码抖动；密码错误横幅显示后端 `msg` 原文；正常登录 → 存令牌 → 跳回 `redirect` 目标；Header 变用户名 chip；退出清态；勾/不勾「记住我」后刷新与重开标签页的存活差异；手改过期令牌 → 请求 401 → 自动清态回登录页。
3. 真链路需网关 8100 + Nacos + MySQL(`users_dev`) + Redis 全部在线。任一未起时，§4 的网络错误归一转成可见提示；此时上述「密码错误 / 真登录」两条无法实测，会在交付报告里明确标注为未验证，不谎报通过。
4. dev 内置浏览器窗口偏窄，以 `take_snapshot` 为优先验证手段，截图为辅。

## 11. 实测修正（2026-10-10 实现后，真网关 8100 + MySQL + Redis 在线）

实现完成后接真后端跑了一轮，**三处设计假设被实测推翻**，代码已按实测调整：

1. **`/auth/register` 实测返回 401**，不是先前读 `SecurityConfig.java:32-35` 得出的「permitAll 已放行」。实测 `POST http://127.0.0.1:8100/auth/register` → `{"code":401,"msg":"未登录或Token已过期"}`，即 AuthModule 自身的过滤链没放行注册。
   → 前端的 D5 注册页签**当前必然失败**，横幅会如实显示这条服务端文案。后端一行修复：把 `/auth/register` 加入 `permitAll`。前端代码无需改动。
2. **登录不能套用注册的密码长度规则**。存量账号 `test920` 的真实密码是 6 位（`@Valid` 未生效期间写入），若登录表单也校验 8-64，会把这类账号永久锁在门外——服务端明明认它。
   → `validate()` 改为分标签：登录只要求非空；`^[a-zA-Z0-9_]{4,20}$` 与密码 8-64 只在注册时生效（那是写入约束）。
3. **`logout()` 之后必须显式导航**。store 有意不管路由，导致从 `/ai` 退出后仍停在受保护页上且已无会话（守卫不会被再次触发）。
   → 由调用方（`Header.vue` 的 `signOut`）在 `await auth.logout()` 后 `router.replace('/login')`。

网关侧另两处实测印证了 §2.2 / §2.3：裸 token 加 `Bearer ` → `/user/test` 200；小写 `bearer ` 与缺前缀 → `{"code":401,"message":"缺少或无效的授权头"}`；签名非法 → `{"code":401,"message":"无效或过期令牌"}`。

### 已实测通过

守卫拦截 `/ai`→`/login?redirect=/ai`、放行已登录访问；mock 验证码取码/60s 冷却/错码作废并解除冷却；本地校验横幅；真账号滑动登录取回 219 字符 JWT 且 `exp` 按 ISO 字符串正确解析为 24h；记住我开→`localStorage`、关→`sessionStorage` 且另一桶被清；退出清双桶并回 `/login`；Header chip 与 AI 侧栏 Log in CTA 的登录态显隐；两种主题下两个组件的实际色值对比（computed style，非目测——内置浏览器 surface 不可用）。

### 未实测

注册成功链路（被第 1 条阻塞）；`BizError`/`HttpError` 的服务端业务文案分支（重复用户名 500 未能触发）；401 钩子中「带 `?redirect=` 重定向」这一子分支——目前应用内除 logout 外没有其它带 Bearer 的调用点，而 logout 自身的清态与导航会覆盖它，故不可单独观测（401 本身确实产生并被消化，控制台可见 `/gw/auth/logout` 401 且无未捕获异常）。待 AI 模块接上 `/ai/**` 真接口后可自然覆盖。
