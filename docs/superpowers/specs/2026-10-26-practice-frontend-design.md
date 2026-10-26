# 练习侧前端设计（PracticeModule 阶段一 9 接口）

> **For agentic workers:** 实现前先读这份文件与后端计划
> `ezPracticeExercises/docs/superpowers/plans/2026-10-23-practice-0{1,3}-*.md`。
> 本文所有字段名/类型/可空性都是**实测核准**的（读 VO 源码 + 抄端到端落盘字节），不是拟的。

- 日期：2026-10-26
- 状态：待用户评审
- 目标仓库：`EZ_frontend`（Vue 3.5 + Vite 8 + TS 6 + Tailwind 4 + Pinia 4 + vue-router 5）
- 后端：`PracticeModule`（经网关 8100，路由 `/practice/**` 已存在于 Nacos `gateway.yaml`，零网关改动）
- 传输层：`src/api/request.ts`（已存在，**不改**）

---

## 0. 目的、约束与验收标准

**目的**：把已经全部实现并端到端验证过的练习侧 9 个后端接口接到前端，做出可用的"科目刷题"闭环：选科目 → 答题 → 看解析 → 错题本 → 收藏本 → 自评。

**约束**（用户在 brainstorming 阶段逐条选定，不是我的推荐被采纳后的残留）：

1. 第一轮只做**练习侧 9 个接口**；考试侧 8 个接口（`paper/*`、`exam/*`、`attempt/*`）是另一个子项目，另开 spec。
2. 页面结构用**子路由**（`/practice` Layout + children），照现有 `views/AI/Layout.vue` 的形态。
3. **三种取题模式全接**（`mode=1` 顺序/断点、`mode=3` 智能练习、`questionId` 指定重做）—— 用户明确否决了"只接顺序 + 重做"的缩小方案。
4. 视觉预算：**只用 `design.md` 已有的 CSS 变量**跑通功能；玻璃容器、背景动画、移动端精修留独立轮次。
5. 验收方式：**装 vitest，只测纯逻辑**（形状校验、编码/解码、分页归一、答题卡四态、错误映射）；页面本身靠浏览器实跑，不写组件测试、不引 E2E 框架。
6. 错误呈现：**页面级错误条**（可关闭、`code → 中文文案`映射）；空列表走单独空态组件，不用错误条装空。
7. 简答题自评时**前端先隐藏参考答案**，用户点完自评才展开（见 §8 裁定七）。
8. `/practice` 路由**加 `meta.requiresAuth: true`**（见 §8 裁定八）。

**验收标准（绿灯定义）**：`npm test` 全绿 + `npm run build`（含 `vue-tsc --build`）全绿 + §7.5 的浏览器清单逐条实测通过并留证。三者缺一不算完成。

---

## 1. 范围

**做**：`src/api/practice/`、4 个 composable、1 个 store、5 个视图、4 个组件、路由接线、vitest 接入与纯逻辑测试。

**不做**（每一项的理由都在 §9）：考试侧页面、样式升级、`.vue` 组件测试、Playwright、`request.ts` 改动、任何后端代码改动、`qb_paper` 样例数据相关的东西。

---

## 2. 架构与文件清单

三层，依赖单向：`api/` → `composables/` → `views/`。`api/` 不 import 任何 Vue 运行时（这样它能被 vitest 直接 import 而无需任何环境配置）。

```
src/api/practice/
  types.ts          响应接口 + answerStatus 四态常量 + 每接口的形状校验函数
  answer.ts         题型常量 + encodeUserAnswer / decodeUserAnswer + 答题卡四态 + canSelfJudge
  paging.ts         pageSize 上限与 clamp + normalizePage（hasPrev/hasNext 只看 pages）
  errors.ts         code → 中文文案映射（errorText）
  http.ts           buildQuery（丢掉空参，保证 subjectId/questionId 互斥）+ createSeqGuard
  subject.ts        GET /practice/subject/list
  question.ts       GET question/page · GET question/current · POST answer/submit · POST answer/self-judge
  wrongFavorite.ts  GET wrong/page · POST wrong/master · GET favorite/page · POST favorite/toggle

  > **计划阶段更正（2026-10-26）**：本清单原本把 `encodeUserAnswer / normalizePage / errorText / createSeqGuard`
  > 全塞在 `types.ts` 一行里。拆开的原因不是洁癖：契约（后端改字段）、题目语义（题型形态）、
  > 视图口径（分页与文案）、请求管道（拼串与竞态）四件事的变化原因各不相同，
  > 放一个文件里会长成一个几百行的杂物袋，而改动时互相牵连。

src/composables/
  useSubjects.ts    科目列表 + 当前科目（读写 store）
  useDrill.ts       三种取题模式、提交、自评、答题卡、收藏翻转
  useWrong.ts       错题分页 + 状态筛选 + 标记已掌握
  useFavorite.ts    收藏分页 + 取消收藏

src/stores/
  practice.ts       只有 currentSubjectId（写 localStorage）

src/views/Practice/
  Layout.vue        左侧科目栏 + 四个导航项 + <RouterView>
  Subject.vue       科目卡（统计 + 进入练习）
  Drill.vue         答题页
  Wrong.vue         错题本
  Favorite.vue      收藏本
  Index.vue         删除（现占位页，26 行"开发中..."）

src/components/practice/
  AnswerCard.vue    答题卡格子（四态）
  QuestionBody.vue  按 type 1/2/3/4/5 渲染作答控件
  ErrorBar.vue      页面级错误条（可关闭）
  EmptyState.vue    空态

src/**/__tests__/*.spec.ts   新增测试（vitest）
vitest.config.ts             新增
tsconfig.vitest.json         新增（挂进根 tsconfig 的 references）
```

**路由改动**（`src/router/index.ts`）：现有单条

```ts
{ path: '/practice', name: 'practice', component: () => import('../views/Practice/Index.vue'), meta: { title: '刷题模块' } }
```

改成 Layout + children，并补登录门：

```ts
{
  path: '/practice',
  component: () => import('../views/Practice/Layout.vue'),
  meta: { title: '刷题模块', requiresAuth: true },
  children: [
    { path: '', redirect: { name: 'practice-subject' } },
    { path: 'subject', name: 'practice-subject', component: () => import('../views/Practice/Subject.vue') },
    { path: 'drill', name: 'practice-drill', component: () => import('../views/Practice/Drill.vue') },
    { path: 'wrong', name: 'practice-wrong', component: () => import('../views/Practice/Wrong.vue') },
    { path: 'favorite', name: 'practice-favorite', component: () => import('../views/Practice/Favorite.vue') }
  ]
}
```

守卫已有（`router.beforeEach` 读 `meta.requiresAuth`，未登录跳 `/login?redirect=`），无需新增逻辑。子路由页面不再单独要求登录：`to.matched.some(...)` 会沿 `matched` 链继承父级 meta。

**取题参数走 query 还是 params**：`/practice/drill?questionId=7&mode=3`。用 query 而不是 `params`，因为"刷新页面要能还原当前这题"是硬需求，而 `params` 在没有 path 占位的情况下不写进 URL。

---

## 3. 接口层契约（实测核准）

### 3.1 九个端点

| # | 接口 | 入参 | `data` |
|---|---|---|---|
| 1 | `GET /practice/subject/list` | — | `SubjectItem[]`（**裸数组**，不是 PageVO） |
| 2 | `GET /practice/question/page` | `subjectId`(**必填**) `pageNum` `pageSize` | `PageVO<QuestionItem>` |
| 3 | `GET /practice/question/current` | `subjectId?` `mode?` `questionId?` | `QuestionCurrent` |
| 4 | `POST /practice/answer/submit` | `{subjectId,questionId,userAnswerJson,durationMs,mode}` | `AnswerSubmitResult` |
| 5 | `POST /practice/answer/self-judge` | `{subjectId,questionId,recordId,isCorrect}` | `{statDelta}` |
| 6 | `GET /practice/wrong/page` | `subjectId` `status?` `pageNum` `pageSize` | `PageVO<WrongItem>` |
| 7 | `POST /practice/wrong/master` | `{questionId}` | `boolean` |
| 8 | `GET /practice/favorite/page` | `subjectId` `pageNum` `pageSize` | `PageVO<FavoriteItem>` |
| 9 | `POST /practice/favorite/toggle` | `{subjectId,questionId}` | `{favorited}` |

字段逐个对齐后端 VO（`PracticeModule/src/main/java/org/leon/practicemodule/pojo/vo/`）：

```ts
SubjectItem   { id:number, name:string, subjectKey:string, icon:string, description:string,
                questionCount:number, myTotal:number, myCorrect:number,
                myAccuracy:number /*0~1 两位小数*/, lastAnswerAt:number|null /*epoch ms*/ }

QuestionItem  { index:number, questionId:number, type:number, difficulty:number|null,
                tags:string[], answerStatus:number, favorited:boolean }   // 没有 title

Question      { questionId:number, subjectId:number, type:number, typeName:string,
                title:string, options:{optionKey:string, content:string}[],
                difficulty:number|null, tags:string[], index:number|null,
                score:number|null }        // qb_question 无 score 列，实测恒 null，不许依赖

QuestionCurrent { finished:boolean, question:Question|null, answerStatus:number|null,
                  lastUserAnswerJson:string|null, pendingRecordId:number|null }

AnswerSubmitResult { recordId:number, isCorrect:boolean|null, correctAnswerJson:string,
                     analysis:string, needSelfJudge:boolean,
                     statDelta:{total:number,correct:number,wrong:number,accuracy:number},
                     wrongCount:number, wrongMastered:boolean }

WrongItem     { questionId:number, index:number|null, type:number, titleBrief:string,
                wrongCount:number, lastWrongAt:number|null, status:number,
                lastUserAnswerJson:string|null }

FavoriteItem  { questionId:number, index:number|null, type:number, titleBrief:string,
                createdAt:number|null }

PageVO<T>     { pageNum:number, pageSize:number, total:number, pages:number, list:T[] }
```

### 3.2 `answerStatus` 四态

`0` 未答 / `1` 对 / `2` 错 / `3` 待自评（后端 `AnswerStatus.java`）。待自评对应库里 `is_correct=-1`。

### 3.3 四条不看源码就会接错的

1. **`userAnswerJson` 是"整份 JSON 的文本"，不是 JS 对象**。它直写 MySQL `json` 列，后端 `AnswerGrader.parse` 严格校验：多值文档（`"A" "B"`）与非有限数（`1e999`）一律 40000。前端唯一的出口是 `encodeUserAnswer(type, value)`，别处不许自己拼字符串：

   | type | 控件 | 上送值（即 `JSON.stringify` 的结果） |
   |---|---|---|
   | 1 单选 | `JellyRadio` | `'"A"'` |
   | 2 多选 | 复选框组 | `'["A","B"]'`（键必须属于该题选项，后端校验；乱序先归一） |
   | 3 判断 | 两个按钮 | `'true'` / `'false'` |
   | 4 填空 | N 个输入框 | `'["apple",""]'`（**空位用 `""` 占位，不能省下标**） |
   | 5 简答 | textarea | `'"我的作答"'` |

   `decodeUserAnswer(type, json)` 反向解回控件态；畸形 JSON 一律返回 `null`（当未作答）**而不是抛错** —— 回填失败不能把答题页打死。

2. **`statDelta` 是累计快照，不是增量**（后端 `StatDeltaVO` 的 javadoc 明写）。`submit`/`self-judge` 之后要用它**整体覆盖**本地科目统计，不能做加法。

3. **`pendingRecordId` 只在最近一条作答 `answer_mode IN (1,3)` 时才非 null**。自评接口拒绝考试来源的记录（40000「仅逐题练习作答支持自评」），所以 `answerStatus=3 且 pendingRecordId=null` 的格子里**不能**渲染自评按钮。

4. **`subjectId` 与 `questionId` 在 `question/current` 上只能给一个**（同时给 40000，都不给也 40000）。composable 里必须一次决定、显式清空另一个，不能留两个各自有值的 ref。

另外三条口径：`correctAnswerJson`/`analysis` 也是 JSON 文本/纯文本字符串；时间字段一律 epoch 毫秒；`icon` 实测是 `"icon-chinese"` 这类**类名 token，仓库里没有对应资源** → 前端按 `subjectKey` 映射自己的图标，映射不到就用 `name` 首字。

### 3.4 真实响应样本（抄自端到端落盘字节，测试夹具直接用它）

```jsonc
// subject/list
{"code":1,"msg":"success","data":[{"id":1,"name":"语文","subjectKey":"chinese","icon":"icon-chinese",
  "description":"语文题库测试科目","questionCount":4,"myTotal":10,"myCorrect":7,
  "myAccuracy":0.7,"lastAnswerAt":1792805141000}, ...]}

// question/current（做完该科时的 finished 形态：answerStatus 也是 null）
{"code":1,"msg":"success","data":{"finished":true,"question":null,"answerStatus":null,
  "lastUserAnswerJson":null,"pendingRecordId":null}}

// question/current（指定题重做，有上次作答）
{"code":1,"msg":"success","data":{"finished":false,
  "question":{"questionId":7,"subjectId":2,"type":1,"typeName":"单选题",
    "title":"这是用户 bob 的私有题，哪个正确？",
    "options":[{"optionKey":"A","content":"用户3选项A"}, ...],
    "difficulty":1,"tags":["私有","用户3"],"index":2,"score":null},
  "answerStatus":2,"lastUserAnswerJson":"\"A\"","pendingRecordId":null}}

// answer/submit（答错）
{"code":1,"msg":"success","data":{"recordId":38,"isCorrect":false,"correctAnswerJson":"\"C\"",
  "analysis":"C 是正确选项。","needSelfJudge":false,
  "statDelta":{"total":3,"correct":2,"wrong":1,"accuracy":0.67},"wrongCount":1,"wrongMastered":false}}

// answer/self-judge
{"code":1,"msg":"success","data":{"statDelta":{"total":11,"correct":8,"wrong":3,"accuracy":0.73}}}

// wrong/page（非空）
{"code":1,"msg":"success","data":{"pageNum":1,"pageSize":20,"total":1,"pages":1,
  "list":[{"questionId":7,"index":2,"type":1,"titleBrief":"这是用户 bob 的私有题，哪个正确？",
    "wrongCount":1,"lastWrongAt":1792811456000,"status":1,"lastUserAnswerJson":"\"A\""}]}}

// wrong/page（空）
{"code":1,"msg":"success","data":{"pageNum":1,"pageSize":20,"total":0,"pages":0,"list":[]}}

// favorite/page
{"code":1,"msg":"success","data":{"pageNum":1,"pageSize":20,"total":1,"pages":1,
  "list":[{"questionId":1,"index":1,"type":1,"titleBrief":"下列选项中，正确的是？","createdAt":1792811457000}]}}
```

### 3.5 运行时校形状

`request<T>` 的泛型是**纯断言**，编译期之后不做任何检查；后端字段改名只会让页面渲染 `undefined` 进答题卡。所以照 `src/api/auth.ts` 已有的做法：每个取数函数内部拿 `request<unknown>`，逐字段 `typeof`/`Array.isArray`/可空性判定，不合格抛 `HttpError('<接口名>响应格式异常：<字段>', 0)`，对外签名只暴露窄类型。这些校验函数是 vitest 的主要被测对象（§7.3）。

---

## 4. 状态与数据流

### 4.1 store

`stores/practice.ts` 只有一个字段：`currentSubjectId`，读写 `localStorage`（键 `practice:subjectId`）。科目列表、题目、答题卡、分页态、在途请求全都留在页面级 composable —— 跨页共享"正在看哪一科"值得进 store，其它进 store 只会制造第二份真相。

### 4.2 三种取题模式 = 一个函数的三种入参

| 模式 | 调用 | 后端语义（源码核准） |
|---|---|---|
| 顺序/断点 | `current({subjectId, mode:1})` | 按 `(sort_order, id)` 全序取第一道未答题；`answerStatus` 恒 0；全部做完回 `{finished:true, question:null, answerStatus:null}` |
| 智能练习 | `current({subjectId, mode:3})` | 先取一条"未掌握错题"，**没有则退化成顺序**（`QuestionReadServiceImpl:122-126`）；返回的题 `answerStatus` 可能是 2，不能假设未答 |
| 指定重做 | `current({questionId})` | 从错题本/收藏本/答题卡点进任意题 |

`submit` 的 `mode` 只接受 1 或 3（`mode=2` 考试被 40000 拒）。重做流的 `mode` 取"进入本页时选的模式"，默认 1 —— 它写进 `qb_user_answer_record.answer_mode`，而科目统计只累计 `answer_mode IN (1,3)`。

### 4.3 Drill 页数据流

```
进入 /practice/drill
  ├─ 拉 question/page?subjectId&pageSize=100  → 答题卡（一科总题数远小于 100）
  └─ 拉 question/current（按当前模式）        → 本题正文 + 上次作答 + pendingRecordId
作答 → encodeUserAnswer → answer/submit
  ├─ needSelfJudge=false：渲染解析面板（correctAnswerJson + analysis + 答题卡该格变 1/2）
  └─ needSelfJudge=true ：渲染自评按钮，参考答案先藏着（§8 裁定七）
自评 → answer/self-judge{recordId} → 展开解析，格子从 3 变 1/2
"下一题" → 再调 question/current
```

**答题卡状态**：格子态直接映射 `answerStatus`。提交成功后本地把那一格写成 `needSelfJudge ? 3 : isCorrect ? 1 : 2` —— 这是唯一允许本地写状态的一处，且写的是后端刚给的事实（注意 `isCorrect` 在待自评时是 `null` 而不是 `false`）。其它情况一律靠重拉 `question/page`，不自造口径。

**`recordId` 的两个来源**：本轮刚提交 → `submit` 响应里的 `recordId`；刷新后回到一道待自评的题 → `current` 的 `pendingRecordId`。

**收藏星标**：初值来自 `question/page` 的 `favorited`；点击调 `favorite/toggle`，以响应的 `{favorited}` 为准写回，不做乐观翻转。

**分页**：`pageNum/pageSize` 的 offset 分页（不是 cursor）。`pageSize` 上限 100，超了后端 40000，前端夹住；越界页后端照回**真 `total` + 空 `list`**（`QuestionReadServiceImpl:69-72`），所以"下一页"按钮的 disabled 判据是 `pages`，不能把空 `list` 当"没有题"。

**错题本**：`status` 只接受 `1`（未掌握）/ `2`（已掌握）/ 省略。`wrong/master` 回 `boolean`，成功后从当前页移除该行并把 `total` 减 1（整页重拉会让用户以为没生效）。"已掌握"再答错会翻回未掌握 —— 后端行为，前端只反映。

### 4.4 竞态

切科目、切模式、翻页都会让在途请求过期。`request.ts` 不接受 `signal`，所以用**请求序号**丢弃过期响应：每个 composable 一个 `let seq = 0`，发起前 `const mine = ++seq`，回来时 `mine !== seq` 就整个丢弃（不写状态、不清 loading）。判据是"连切两个科目，最终答题卡属于最后那个"。

---

## 5. 页面与组件

**Layout.vue**：左侧竖栏 = 科目列表（`name` + `questionCount`，选中高亮，点击写 store）+ 四个导航项（科目总览 / 练习 / 错题本 / 收藏本）；右侧 `.page-area` 挂 `<RouterView>`。形态照 `views/AI/Layout.vue`（`position: fixed; inset: 0`，sidebar + main），样式只用 `design.md` 变量。移动端把侧栏折叠成顶部横条。

**Subject.vue**：科目卡网格。每卡给 `name`、`description`、`questionCount`、`myTotal`、`myCorrect`、`myAccuracy`（**0~1 的比值，渲染成 `70%`**）、`lastAnswerAt`（epoch ms → `Intl.DateTimeFormat` 本地化，不引日期库）。点卡片 → 写 store + 跳 `/practice/drill`。

**Drill.vue**：科目名 + 模式切换（顺序 / 智能练习）→ `QuestionBody` → 提交按钮 → 解析面板（正确答案、`analysis`、`wrongCount`/`wrongMastered`）→ `AnswerCard`。`finished=true` 时渲染 `EmptyState`（"本科目已全部作答"）。题干用 `title` 原文；`index` 显示为"第 N 题"。

**QuestionBody.vue**：按 `type` 分支渲染（五题型见 §3.3 的表），内部只维护结构化作答态，字符串编码交给 `encodeUserAnswer`。`type` 不在 1..5 → 抛错并让页面出错误条，不渲染空表单。

**AnswerCard.vue**：格子 = 题号 + 四态配色（`design.md` 的 `--ok`/`--bad`/`--warn`/中性），当前题加描边，点击 `emit('select', questionId)` → 页面走重做流。

**ErrorBar.vue / EmptyState.vue**：错误条可关闭、同屏只一条、新一轮请求开始时自动清旧错误；空态单独组件。

**开放项（实现第一个任务先实测，不靠猜）**：填空题的空位数没有字段可依据 —— `Question` 只有 `title/options/score/index`，槽数在 `answer_json` 里，而那是脱敏出口不会给的真值。计划任务 1 先查库里 `type=4` 的题干实测占位符形态（`(   )` / `___` / 其它）：数得出就按占位符数渲染 N 个输入框；数不出来就退化成单个 textarea、按换行切成数组提交。两种后端都收（逐位比对），差别只在交互。

> **更正（2026-10-26，Task 2 用只读 JDBC 探针实测 `qb_question`，探针与输出在仓库外 `…/tmp/F--AAAJAVA-code-EZ_frontend/probe/`）**：启用题共 **7** 道，`type` 分布 **1:3 / 2:1 / 3:1 / 4:1 / 5:1**。唯一那道填空题 `qid=4`（科目 2）题干是 `植物通过____作用将光能转化为化学能。`，`answer_json` 是 `["光合作用"]` —— **占位符 1 个 == 槽数 1 个**，1/1 题命中，按"≥ 一半"的判据 **`blankMode = 'counted'`** 成立，按占位符数渲染 N 个输入框；`freeform` 那条分支照旧实现并留着测试（数据只有 1 道填空题，样本量不足以把它当普适结论，将来录题形态一变就要重取证据）。
>
> 同一次探针还给 Task 15 的浏览器清单钉了可点的真实 id：科目 1（语文）有 `type=1` 的 **1/6**、`type=2`（多选）的 **2**、`type=5`（简答，走裁定七）的 **5**；科目 2（数学）有 `type=1` 的 **7**、`type=3`（判断）的 **3**、`type=4`（填空）的 **4**。也就是说**五种题型都能点到**，但判断与填空只在科目 2、多选与简答只在科目 1 —— 实跑时必须两个科目来回切，不能只停在一科。

---

## 6. 错误呈现

原则：**语义唯一的 code 用固定文案，一模多义的 code 用后端中文 `msg`**（`PracticeException` 的 msg 本来就是给人看的）。

| 来源 | 处理 |
|---|---|
| `40000` | 展示 `msg` + `console.warn`。这类命中基本都是前端拼参错（"subjectId 与 questionId 只能给一个"、"答题模式只能是 1刷题 或 3智能练习"、"答案不能为空"、"单题用时不能为负"、"掌握状态只能是 1未掌握 或 2已掌握"），是 bug 信号，不能只弹文案 |
| `40100` | 固定文案"登录状态异常，请重新登录" + 引导按钮（`users_dev` 查不到该用户名才会出，语义唯一） |
| `40300` | 固定文案"无权操作该作答"（练习侧只有自评别人的 `recordId` 才命中） |
| `40400` | 固定文案"内容可能已更新，请刷新重试"（科目/题目/作答记录三种缺失语义不可分辨） |
| `40900` | 展示 `msg`（"题目已下架"、"科目已停用"、"该记录已完成自评"三义，映射表会把信息丢掉） |
| `AuthError`（HTTP 401/403） | **页面不该看到**：`request.ts` 已调 `setUnauthorizedHandler` 清令牌跳登录。`errorText()` 对它返回 `null`，页面不渲染错误条 |
| `HttpError(status=0)` | 展示 `msg`："无法连接服务器，请确认网关已启动" / "请求超时，请稍后重试"。网关没起是最常见的真实故障，这句原话要留着 |
| 形状校验抛的 `HttpError` | 展示 `msg`（已含"哪个接口哪个字段"） |

`41001`/`41002` 是考试侧的码，本轮不会出现，映射表里**不留占位**（留了就是给未来编造依据）。

---

## 7. 测试与验收判据

### 7.1 装法（唯一新依赖）

`npm i -D vitest@^5.0.5` —— peer `^6.4.0 || ^7.0.0 || ^8.0.0`，与本地 vite `8.2.2` 对得上；`node` 实测 v24.14.1，满足 `engines`。**不装** `jsdom`/`happy-dom`/`@vue/test-utils`/`@vitest/ui`（只测纯逻辑，无 DOM）。

新增 `vitest.config.ts`：`environment: 'node'`、`include: ['src/**/*.spec.ts']`。`tsconfig.node.json` 的 `include` 里本来就预留了 `vitest.config.*`。

### 7.2 两个运行器按扩展名分治（实测决定）

现有 3 个测试文件（`src/api/__tests__/sse.test.ts`、`src/components/AI/__tests__/streamMarkdown.test.ts`、`src/composables/__tests__/thinkingPace.test.ts`）用的是 `node:test` + `node:assert/strict`，**它们不是坏测试，只是没接进 script**。实测：

```
$ node --test src/api/__tests__/sse.test.ts
ℹ tests 10  ℹ pass 10  ℹ fail 0
```

它们继续归 `node --test`，新写的练习侧测试一律 `*.spec.ts` 归 vitest。不迁移那三个：迁移要动另外两个 initiative 的文件，而 vitest 默认还会按 `*.test.ts` 把它们收进来、发现没有 suite 直接报错。

```jsonc
"scripts": {
  "test":        "run-s test:node test:vitest",   // npm-run-all2 已在 devDependencies
  "test:node":   "node --test \"src/**/__tests__/*.test.ts\"",
  "test:vitest": "vitest run"
}
```

### 7.3 纯函数测试清单（全部无网络、无 DOM）

| 函数 | 必须覆盖 |
|---|---|
| `encodeUserAnswer` | 五题型各一条，输出**逐字符**对齐 §3.4 样本；多选乱序归一；填空保留空位 `""`；`type` 未知抛错 |
| `decodeUserAnswer` | 五题型正向；畸形 JSON / 类型不符 → `null` 且不抛 |
| 9 个形状校验 | 每条喂一份真实样本；逐字段缺失、改类型、塞 `null` → 抛 `HttpError`，且报文能指出哪个接口哪个字段；`finished=true` 那条要接受 `answerStatus:null` |
| `normalizePage` | `pages` 算法；越界页"真 total + 空 list" → 下一页 disabled；`pageSize` 夹到 ≤100 |
| `cardState` | 0/1/2/3 穷举；提交后迁移表（含 `isCorrect=null` 那支） |
| `canSelfJudge` | `3+非null` → true；`3+null` → false；非 3 一律 false |
| `errorText` | §6 逐码；未知 code 回落 `msg`；`AuthError` → `null`；`status=0` 保留原话 |
| `createSeqGuard` | `seq=1` 在途时发 `seq=2`，`1` 的迟到响应必须被丢 |
| `clampDuration` | 负数 → 0 |

夹具放进 `src/api/practice/__tests__/fixtures.ts`（从 §3.4 抄成字面量；**不读外部文件**，端到端落盘目录在仓库外且是 gitignored）。

### 7.4 类型检查门要补一处

`tsconfig.app.json` 的 `exclude: ["src/**/__tests__/*"]` 让测试文件不参与 `vue-tsc`，而 vitest 只剥类型不检查 —— 契约防线的测试自己是不被类型检查的。新增 `tsconfig.vitest.json`（extends `tsconfig.app.json`、`include` 测试目录、`composite: true`、`types: ["node"]`）并挂进根 `tsconfig.json` 的 `references`，让 `npm run build` 一起管住它们。

### 7.5 浏览器实跑清单（页面本体的验收）

`npm run dev`（5173，经 `/gw` 代理到网关 8100），账号 `test918`（口令只从环境/手输来，**绝不写进任何文件或日志**）。逐条实测：

1. 未登录访问 `/practice` → 跳 `/login?redirect=/practice/subject`
2. 登录后科目卡的 `questionCount/myTotal/myCorrect/正确率` 与 `subject/list` 响应一致
3. 顺序模式答一题 → 答题卡该格当场变色，题号描边跟随
4. 答错 → 解析面板出 `correctAnswerJson` 与 `analysis`
5. 简答题答完 → 只有自评按钮、**没有参考答案**；点"答对了" → 参考答案展开、科目统计按 `statDelta` 快照更新
6. 错题本点某题 → 作答框回填 `lastUserAnswerJson`
7. 星标翻转 → 收藏本出现该题 → 再点取消 → 收藏本消失
8. 慢网络（devtools 关 throttling 或连点）切两个科目 → 答题卡属于最后那个（竞态判据）
9. 某科做完 → `finished` 空态，不是空白
10. 停掉网关 → "无法连接服务器，请确认网关已启动"
11. 移动端宽度（375px）侧栏折叠、答题卡不换行错乱

### 7.6 审查状态

按用户规则（2026-10-24 起）：实现与自查都在主线，**不派子代理**，完成报告须明写"未做独立审查轮次"。

---

## 8. 用户裁定汇总

| # | 裁定 | 出处 |
|---|---|---|
| 一 | 第一轮只做练习侧 9 接口 | brainstorming 第 1 问 |
| 二 | 装 vitest、只测纯逻辑 | 第 2 问 |
| 三 | 子路由 Layout + children | 第 3 问 |
| 四 | 三种取题模式全接 | 第 4 问（否决了"只接顺序+重做"） |
| 五 | 只用 `design.md` 现有变量，样式升级独立轮次 | 第 5 问 |
| 六 | 页面级错误条 + 单独空态 | 第 6 问 |
| 七 | **前端在 `needSelfJudge=true` 时先隐藏 `correctAnswerJson`，自评后才展开**；后端契约不动 | §5/§7.5-5 |
| 八 | `/practice` 加 `meta.requiresAuth: true` | §2 |

裁定七的背景：后端在 `needSelfJudge=true` 时 `isCorrect=null`，但 `correctAnswerJson` 与 `analysis` **照样返回**（`AnswerServiceImpl.java:90-91` 无条件 set）。照实渲染就是"参考答案和自评按钮同屏"，自评等于抄答案 —— 这是段 2 起挂在后端接缝表里没裁的产品问题，本轮由前端收口。后端如果将来改成不返回，前端这段逻辑要同步简化（`correctAnswerJson` 变 null 时不渲染展开区），**不能反过来依赖后端配合**。

---

## 9. 范围外与接缝

| 接缝 | 归谁 | 具体 |
|---|---|---|
| 考试侧 8 接口 | 下一个子项目（另开 spec） | 自带状态机：服务端 `deadlineAt` 对表、`41001/41002`、草稿整包覆盖、`answered_json` 键是题号字符串、超时只在下次 `start`/`submit` 懒归档。本 spec 只承诺两条：`api/practice/` 的分层与形状校验写法照抄可用；`QuestionBody.vue` 与 `encodeUserAnswer` 若被考试页复用，**必须共用同一个编码器**（两处各写一遍迟早分叉，分叉的代价是写 `json` 列报错） |
| 简答题自评的脱敏时机 | 后端（若产品要收口） | 裁定七是前端缓解。真正的修法要动 `AnswerServiceImpl` 并补一条响应字节守卫，属独立轮次 |
| `mode=3` 策略口径 | 后端 | 前端不做本地"优先错题"排序，只换 `mode` 传参。要"随机""只未做"等新语义是后端新查询 |
| `titleBrief` | 后端脱敏口径 | 错题本/收藏本只有截断标题，完整题干必须再调一次 `current?questionId=`；列表页不许试图拼题干 |
| 样式升级 | 独立轮次 | 玻璃容器、背景动画、移动端精修。本轮只用 `design.md` 变量 + 已有 `JellyRadio`/`SpecularButton` |
| db-it 式真库对拍 | 不适用 | 前端没有等价物；契约风险由 §7.3 的形状校验 + §7.5 的浏览器实跑两层承担 |

---

## 10. 自查（写完后逐项过）

- **占位符**：无 TBD/TODO；唯一的"待实测"是填空题占位符形态，已写成"任务 1 实测 + 两种收口方案"，不是空白。
- **内部一致**：`answerStatus` 四态在 §3.2/§4.3/§5/§7.3 口径一致；`statDelta` 是快照这条在 §3.3 与 §7.5-5 一致；路由 meta 与守卫（`to.matched.some`）一致。
- **类型一致**：`PageVO.list`（不是 AI 模块的 `items`）、`AnswerSubmitResult.isCorrect: boolean|null`、`pendingRecordId: number|null` 全文一致。
- **范围**：单一子项目，一份计划可实现；考试侧已明确切出去。
- **依据可核**：每个字段都能指到后端 VO 源码或 §3.4 的落盘字节；两条口径（`statDelta` 是快照、`needSelfJudge` 时仍返回答案）分别指到 `StatDeltaVO` javadoc 与 `AnswerServiceImpl:90-91`。
