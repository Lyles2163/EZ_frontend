# 练习侧前端联调（PracticeModule 9 接口）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task（**用户规则禁子代理，所以本计划只在主线执行**）。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已实现并端到端验证过的练习侧 9 个接口接进 `EZ_frontend`，做出可用的科目刷题闭环（选科目 → 答题 → 解析 → 自评 → 错题本 → 收藏本）。

**Architecture:** 三层单向依赖 —— `src/api/practice/`（纯取数 + 运行时形状校验，不 import Vue）→ `src/composables/`（状态与流程）→ `src/views/Practice/`（渲染）。传输层复用既有 `src/api/request.ts`，网关路由与后端零改动。

**Tech Stack:** Vue 3.5 + Vite 8 + TS 6 + Pinia 4 + vue-router 5；测试新增 **vitest 5.0.5（唯一新依赖）**；既有 3 个 `node:test` 测试继续归 `node --test`。

**Spec:** `docs/superpowers/specs/2026-10-26-practice-frontend-design.md`（本仓库内，commit `983e5d6`）

**工作目录**：所有命令都在 `F:\AAAJAVA\code\EZ_frontend`（Git Bash：`cd /f/AAAJAVA/code/EZ_frontend`）。后端仓库 `F:\AAAJAVA\code\ezPracticeExercises` 本计划**一行不改**。

---

## Global Constraints

- **不派子代理**（用户规则 2026-10-24）：实现与自查都在主线；完成报告必须明写"未做独立审查轮次"。
- **提交口径**：每个任务绿了就提交，`git add -- <显式路径>` + `git commit -m "…" -- <显式路径>`；**绝不 `git add -A` / `git commit -a`**。工作树里有**用户自己的未提交文件** `src/components/text/ShinyText.vue`（状态 `AM`）与 `src/views/Home.vue`（`M`），**任何一次提交都不许把它们卷进去**。
- **推送**：`origin` = `https://github.com/Lyles2163/EZ_frontend.git`，2026-10-26 实测连不上（443 超时 21s）。网络可用时先 `git log --oneline origin/dev..dev` 确认只推自己的提交，再 `git push`。推不动就照实说，别把"提交成功"说成"推送成功"。
- **秘密**：口令**不写进任何文件、日志、提交信息、终端输出**。测试账号 `test918`（`user_id=10`）的口令由用户手输，或从环境变量 `EZ_PW` 读；脚本日志只记 `token chars = <n>`。
- **依赖预算**：新依赖只允许 `vitest`（devDependency）。**不装** `jsdom`/`happy-dom`/`@vue/test-utils`/`@vitest/ui`/任何日期或状态库。
- **测试边界**：只测纯逻辑（`.spec.ts`）。**不写 `.vue` 组件测试**，不引 Playwright。页面正确性由 Task 15 的浏览器实跑负责。
- **样式预算**：只用已在 `src/App.vue:63-127` 定义的全局令牌 + 本模块自己声明的局部令牌。**不许改 `App.vue`**（那是共享文件）。
- **数据边界**：本计划**不写库、不执行 DDL、不改后端**。端到端点击会产生真实 `qb_user_answer_record`/`qb_user_wrong`/`qb_user_subject_stat`/`qb_user_favorite` 行 —— 这是**预期行为**（练习侧接口本来就是写接口），但 `qb_paper` 的 4 行验收数据一行都不碰（本计划根本不访问它）。
- **时间**：所有接口时间字段是 **epoch 毫秒**。`myAccuracy`/`accuracy` 是 **0~1 的比值**（渲染成百分比要 ×100）。
- **中文与控制台**：Windows 控制台是 GBK，探针与脚本的中文结果**必须落 UTF-8 文件再用 Read 读**，不要指望终端输出可读。

---

## 事实清单（写计划时逐条实测，出处都给到行号）

执行者不需要重新发现这些；如果与你的观察冲突，**以代码/库为准并就地更正本清单**。

1. **传输层已收口一切信封**。`src/api/request.ts`：`BASE_URL = import.meta.env.VITE_API_BASE || '/gw'`（`:11`），超时 15s（`:12`），`code !== 1` → `BizError(message, code)`（`:145-147`），HTTP 401/403 → `AuthError` **并且已经**调用 `setUnauthorizedHandler` 清令牌跳登录（`:129-134`），无响应/超时 → `HttpError(msg, 0)`（`:120-123`），`envelope: 'result'` 默认解包 `data`（`:148`）。**有 body 就走 POST，无 body 走 GET**（`:100`）。
2. **vite 代理已有**：`/gw` → `http://127.0.0.1:8100`（`vite.config.ts`），网关无 CORS，所以只能走代理。
3. **9 个端点与参数名**（`PracticeModule/.../controller/`，逐个抄）：
   - `GET /practice/subject/list`（`PracticeSubjectController:31-32`，无参）
   - `GET /practice/question/page` `@RequestParam Long subjectId`（**必填**）、`pageNum?`、`pageSize?`（`PracticeQuestionController:33-37`）
   - `GET /practice/question/current` `subjectId?`、`mode?`、`questionId?`（`:46-50`）
   - `POST /practice/answer/submit` body `AnswerSubmitReq{subjectId,questionId,userAnswerJson,durationMs,mode}`（`PracticeAnswerController:32-34`）
   - `POST /practice/answer/self-judge` body `{subjectId,questionId,recordId,isCorrect}`（`:39-41`）
   - `GET /practice/wrong/page` `subjectId`(**必填**)、`status?`、`pageNum?`、`pageSize?`（`PracticeWrongController:31-36`）
   - `POST /practice/wrong/master` body `{questionId}`，返回 `Result<Boolean>`（`:41-43`）
   - `GET /practice/favorite/page` `subjectId`(**必填**)、`pageNum?`、`pageSize?`（`PracticeFavoriteController:32-36`）
   - `POST /practice/favorite/toggle` body `{subjectId,questionId}`（`:41-43`）
   - `X-User-Name` 是 `@RequestHeader`，由网关注入，**前端只带 Bearer 令牌**，不要自己塞这个头。
4. **可空性**（读 VO 源码）：`QuestionItem` **没有 `title`**；`Question.score` 恒 `null`（`qb_question` 无 score 列）；`Question.index` 可空；`WrongItem.index`/`lastWrongAt`/`lastUserAnswerJson` 可空；`FavoriteItem.index`/`createdAt` 可空；`SubjectItem.lastAnswerAt` 可空；`AnswerSubmitResult.isCorrect` 是 `Boolean`（待自评时 **`null`，不是 `false`**）。
5. **`answerStatus` 四态**：0 未答 / 1 对 / 2 错 / 3 待自评（`service/AnswerStatus.java`，库里 `is_correct=-1` 即 3）。
6. **`statDelta` 是累计快照不是增量**（`pojo/vo/StatDeltaVO.java:4-6` javadoc 明写）。提交/自评之后**整体覆盖**本地统计，绝不做加法。
7. **待自评时后端仍返回参考答案**：`AnswerServiceImpl:89-91` —— `isCorrect=null`，但 `correctAnswerJson` 与 `analysis` 无条件 set。裁定七（前端先隐藏）就是为这条存在的。
8. **`pendingRecordId` 只在最近一条作答 `answer_mode IN (1,3)` 时非 null**（`QuestionReadServiceImpl:150`）。自评闸门（`AnswerServiceImpl:116`）会拒考试来源的记录，回 40000「仅逐题练习作答支持自评」。
9. **`userAnswerJson` 是整份 JSON 的文本**：直写 MySQL `json` 列，后端严格 parse，多值文档（`"A" "B"`）与非有限数（`1e999`）一律 40000。五题型的形态见 §Task 4 的表。
10. **越界页回真 total + 空 list**（`QuestionReadServiceImpl:69-72`、`WrongBookServiceImpl:57-59`）：`hasNext` 的判据是 `pages`，不能拿 `list.length` 当"有没有题"。
11. **`pageSize` 上限 100，超了 40000**（`service/PracticePages`，`resp-31-pagesize-101.json` 实测）。`mode=3` 在没有未掌握错题时**退化成顺序**（`QuestionReadServiceImpl:122-126`），所以智能练习返回的题 `answerStatus` 可能是 2。
12. **错误码语义**（各 impl 的 throw 处）：40000 多义（参数/格式/自评闸门）；40100 唯一（`UserIdentityServiceImpl:45,56`）；40300 唯一（`AnswerServiceImpl:111`）；40400 三义（科目/题目/记录不存在）；40900 三义（题目已下架 / 科目已停用 / 该记录已完成自评）。41001/41002 是考试侧，本轮不会出现。
13. **`icon` 是类名 token，不是资源**：实测 `subject/list` 返回 `"icon-chinese"` / `"icon-math"`（`seg3/resp-01-subject-list.json`），仓库里没有对应图片/字体 → 按 `subjectKey` 映射本地图标，映射不到用 `name` 首字。
14. **`design.md` 的绿色系令牌是没落地的文档**：真实全局令牌在 `src/App.vue:63-127`，主色是黑白灰（`--primary-500: #18181b`），**没有 `--success`/`--error`/`--warning`**。所以答题卡四态的颜色必须本模块自己声明局部令牌，切换方式照 AI Layout：`useTheme()` 返回 `'dark'` 时给根元素加 `.dark` 类。
15. **`useTheme()` 只读**（`src/composables/useTheme.ts`），主题由 `App.vue:27` 挂在 `<html data-theme>` 上。
16. **`JellyRadio` 的对外形状**：`items?: (string | { value, label, … })[]`、`value?: string`、**只 emit `change: [value: string, index: number]`**（`:73`、`:201`）。**它没有 `update:value`，不能 `v-model`**。
17. **测试床现状**：`package.json` 无 `test` 脚本、无 vitest；3 个既有测试用 `node:test` 写，实测 `node --test src/api/__tests__/sse.test.ts` → `tests 10 / pass 10 / fail 0`；`tsconfig.app.json` 的 `exclude: ["src/**/__tests__/*"]`（测试不参与类型检查）；`tsconfig.node.json` 的 `include` 已预留 `vitest.config.*`；`npm run type-check` 当前**绿**（`vue-tsc --build` 无输出）。
18. **vitest 版本**：最新 `5.0.5`，peer `vite ^6.4.0 || ^7 || ^8`（本地 8.2.2 相容）；node `v24.14.1` 满足 `engines`。
19. **auth store**：`isLoggedIn = !!token && exp > Date.now()`；`FALLBACK_PATH = '/practice'`（登录后默认落练习页，所以本模块就是主入口）；守卫用 `to.matched.some(r => r.meta.requiresAuth)` → **父路由 meta 被子路由继承**，子路由不用各自再写。
20. **探针配方**（Task 2 要用）：`JAVA_HOME=C:/Users/Administrator/.jdks/ms-21.0.11`，`"$JAVA_HOME/bin/java" -cp "C:/Users/Administrator/.m2/repository/com/mysql/mysql-connector-j/8.0.31/mysql-connector-j-8.0.31.jar;." Probe.java <输出文件>`。**classpath 必须 Windows 风格、`;` 分隔、带盘符**，否则 `No suitable driver found`。库 = `jdbc:mysql://localhost:3306/ezpracticeexercises`，`root` / 空口令。
21. **服务前提**：8100 网关、8102 PracticeModule、8103 认证服务都要在听。**用户通常自己从 IDEA 起服务**。检查：`netstat -ano | grep -E ":8100|:8102|:8103" | grep LISTENING`。如果 8102 的监听 PID 与你启动的 JVM PID 不相等，那是**别人的实例**占了端口，别把打它拿到的 `code=1` 当成自己代码的证据（2026-10-24 踩过）。缺服务就报出来请用户起，不要静默跳过浏览器实跑。

---

## 文件结构

```
新建
  vitest.config.ts                                 测试床（node 环境，include *.spec.ts）
  tsconfig.vitest.json                             让测试也进类型检查门
  src/utils/datetime.ts                            formatDateTime(ms|null)
  src/api/practice/types.ts                        响应接口 + answerStatus 常量 + 9 个形状校验
  src/api/practice/http.ts                         buildQuery + createSeqGuard
  src/api/practice/answer.ts                       题型常量 + encode/decode + 四态 + canSelfJudge + clampDuration
  src/api/practice/paging.ts                       PAGE_SIZE_MAX + clampPageSize + normalizePage
  src/api/practice/errors.ts                       errorText(err) → 中文文案 | null
  src/api/practice/subject.ts                      fetchSubjects
  src/api/practice/question.ts                     fetchQuestionPage / fetchCurrent / submitAnswer / selfJudge
  src/api/practice/wrongFavorite.ts                fetchWrongPage / markMastered / fetchFavoritePage / toggleFavorite
  src/stores/practice.ts                           currentSubjectId（localStorage 续命）
  src/composables/useSubjects.ts                   科目列表 + 当前科目
  src/composables/useDrill.ts                      三种取题模式 + 提交 + 自评 + 答题卡 + 收藏
  src/composables/useWrong.ts                      错题分页 + 状态筛选 + 标记已掌握
  src/composables/useFavorite.ts                   收藏分页 + 取消收藏
  src/components/practice/ErrorBar.vue
  src/components/practice/EmptyState.vue
  src/components/practice/QuestionBody.vue
  src/components/practice/AnswerCard.vue
  src/views/Practice/Layout.vue · Subject.vue · Drill.vue · Wrong.vue · Favorite.vue
  src/api/practice/__tests__/fixtures.ts           §3.4 的真实响应样本（字面量）
  src/api/practice/__tests__/{types,answer,http,paging,errors,api}.spec.ts
  src/stores/__tests__/practice.spec.ts

修改
  package.json                                     test / test:node / test:vitest / type-check 四条脚本 + vitest 依赖
  src/router/index.ts                              /practice 改子路由 + requiresAuth
  docs/superpowers/specs/2026-10-26-practice-frontend-design.md   （Task 2 的实测结论 + 文件清单更正）

删除
  src/views/Practice/Index.vue                     26 行占位页
```

**为什么 `types.ts` 不再装一切**（spec §2 原本写它包含 `encodeUserAnswer` 等）：那是个杂物袋。校验器属于"契约"，编解码属于"题目语义"，分页与错误属于"视图口径"，三者变化原因不同 → 拆成 `types.ts` / `answer.ts` / `paging.ts` / `errors.ts`。已在本计划 Task 3 Step 6 顺手把 spec 的文件清单更正掉。

---

## Task 1：测试床接通（vitest + 双运行器 + 类型检查门）

**Files:**
- Create: `vitest.config.ts`, `tsconfig.vitest.json`, `src/api/practice/__tests__/smoke.spec.ts`
- Modify: `package.json`（scripts + devDependencies）

**Interfaces:**
- Consumes: 无
- Produces: `npm test`（跑 `test:node` 再 `test:vitest`）、`npm run test:vitest -- <file>`（单跑一个 spec）、`npm run type-check`（现在同时检查 app 与 spec）。后续每个任务都用它们取红/取绿。

- [ ] **Step 1: 先取一次"没有测试运行器"的真实红灯**

Run: `cd /f/AAAJAVA/code/EZ_frontend && npx vitest run`
Expected: 非零退出（`vitest` 不是可执行文件 / 拉不到命令）。**把真实报错原文贴进执行记录**，这条就是"先红"。

- [ ] **Step 2: 装 vitest（唯一新依赖）**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm i -D vitest@^5.0.5
```

不要加 `--save-exact`，也不要顺手 `npm audit fix`（会改 lock 里无关的包）。

- [ ] **Step 3: 写 `vitest.config.ts`**

```ts
// vitest.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// node 环境就够：本仓库只测纯逻辑，DOM 组件一律靠浏览器实跑验收。
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // 只收 .spec.ts：既有 3 个 *.test.ts 是 node:test 写的，
    // vitest 收到它们会因为找不到 vitest 的 suite 而直接报错。
    include: ['src/**/*.spec.ts'],
  },
})
```

- [ ] **Step 4: 写 `tsconfig.vitest.json`**

```jsonc
// tsconfig.vitest.json
{
  "extends": "./tsconfig.app.json",
  "include": ["env.d.ts", "src/**/*.spec.ts"],
  "compilerOptions": {
    "types": ["node"]
  }
}
```

它**不进**根 `tsconfig.json` 的 `references`：`vue-tsc --build` 要求被引用的项目 `composite: true`，而 `tsconfig.app.json` 现在没设 —— 加 `composite` 会连锁要求 `noEmit` 调整，风险大于收益。改成第二条独立命令检查（Step 5）。

- [ ] **Step 5: 改 `package.json` 的 scripts**

```jsonc
  "scripts": {
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "preview": "vite preview",
    "build-only": "vite build",
    "type-check": "vue-tsc --build && vue-tsc --noEmit -p tsconfig.vitest.json",
    "test": "run-s test:node test:vitest",
    "test:node": "node --test \"src/**/__tests__/*.test.ts\"",
    "test:vitest": "vitest run"
  },
```

`run-s` 来自已在依赖里的 `npm-run-all2`。

- [ ] **Step 6: 写一条会失败的 smoke spec**

```ts
// src/api/practice/__tests__/smoke.spec.ts
import { describe, expect, it } from 'vitest'

describe('测试床', () => {
  it('vitest 能 import 项目源码并解析 HttpError', async () => {
    const { HttpError } = await import('../../request')
    expect(new HttpError('x', 0).status).toBe(0)
  })
})
```

Run: `npm run test:vitest` → 期望 **PASS**。真正的"红"在 Step 1；这里如果失败，通常是 alias 或 `include` 写错，**先修配置再往下走**，别改测试迁就配置。

- [ ] **Step 7: 三条门都绿**

```bash
cd /f/AAAJAVA/code/EZ_frontend
npm test                 # 期望：node:test 的 10 条 + vitest 的 1 条全绿
npm run type-check       # 期望：两条命令都无输出（app + spec 都检查）
```

`node --test "src/**/__tests__/*.test.ts"` 在 Windows 下由 **node 自己展开 glob**（Node 21+ 支持），不靠 shell，所以路径分隔符不用改。如果它报"没有匹配文件"，改写成 `node --test --test-reporter=spec src`——不行就回到实测报错，别猜。

- [ ] **Step 8: 提交（只提交这四条路径）**

```bash
cd /f/AAAJAVA/code/EZ_frontend
git add -- package.json vitest.config.ts tsconfig.vitest.json src/api/practice/__tests__/smoke.spec.ts
git commit -m "测试床：vitest 收 *.spec.ts、node:test 收既有 3 个、type-check 一起管住测试" -- package.json vitest.config.ts tsconfig.vitest.json src/api/practice
git status --short   # 必须仍是 ShinyText.vue=AM、Home.vue=M，且没有新文件被落下
```

---

## Task 2：契约探针 —— 填空题的渲染形态，用库里真数据定

**Files:**
- Create（仓库外，不进 git）: `C:/Users/Administrator/.qoder-cn/tmp/F--AAAJAVA-code-EZ_frontend/probe/QuestionInventory.java`
- Modify: `docs/superpowers/specs/2026-10-26-practice-frontend-design.md`（§5 的开放项写成实测结论）

**Interfaces:**
- Consumes: 事实清单 20 的探针配方
- Produces: 两个结论 —— ① `blankMode: 'counted' | 'freeform'`（Task 4/9 的 `blankSlots` 用哪个分支）；② 每种题型的真实样本 `questionId`（Task 15 浏览器实跑要按它点）。

- [ ] **Step 1: 写探针（结果写 UTF-8 文件，不指望终端）**

```java
// QuestionInventory.java —— 只读：不写任何表
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;

public class QuestionInventory {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:mysql://localhost:3306/ezpracticeexercises?useSSL=false"
                + "&allowPublicKeyRetrieval=true&characterEncoding=utf8";
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(url, "root", "");
             Statement st = c.createStatement()) {
            sb.append("== type 分布 ==\n");
            try (ResultSet rs = st.executeQuery(
                    "SELECT type, COUNT(*) n, MIN(id) sample_id FROM qb_question"
                            + " WHERE status = 1 GROUP BY type ORDER BY type")) {
                while (rs.next()) {
                    sb.append("type=").append(rs.getInt(1)).append(" n=").append(rs.getInt(2))
                            .append(" sample=").append(rs.getLong(3)).append('\n');
                }
            }
            sb.append("== 填空题原文 ==\n");
            try (ResultSet rs = st.executeQuery(
                    "SELECT id, subject_id, title, answer_json FROM qb_question"
                            + " WHERE type = 4 AND status = 1 ORDER BY id")) {
                while (rs.next()) {
                    sb.append("qid=").append(rs.getLong(1))
                            .append(" subject=").append(rs.getLong(2)).append('\n')
                            .append("title=").append(rs.getString(3)).append('\n')
                            .append("answer=").append(rs.getString(4)).append("\n\n");
                }
            }
        }
        Path out = Path.of(args[0]);
        Files.write(out, sb.toString().getBytes(StandardCharsets.UTF_8));
        System.out.println("written=" + out);
    }
}
```

- [ ] **Step 2: 跑探针**

```bash
cd "C:/Users/Administrator/.qoder-cn/tmp/F--AAAJAVA-code-EZ_frontend/probe"
JAVA_HOME="C:/Users/Administrator/.jdks/ms-21.0.11"
"$JAVA_HOME/bin/java" -cp "C:/Users/Administrator/.m2/repository/com/mysql/mysql-connector-j/8.0.31/mysql-connector-j-8.0.31.jar;." QuestionInventory.java inventory.txt
```

Exit code 非 0 就贴报错原文。**空口令不是秘密泄露**（本机 root 空口令是仓库既成事实，见 `local-service-topology`），但这条命令带 `;` 与盘符路径，抄错就是 `No suitable driver found`。

- [ ] **Step 3: 用 Read 读 `inventory.txt`，按下面的判据定 `blankMode`**

数题干里的**连续占位符**（`___`、`(   )`、`（   ）`、`______`）：把 `title` 与 `answer_json` 摆在一起看，**占位符数量 == `answer_json` 数组长度**的题占比 ≥ 全部填空题的**一半** → `blankMode='counted'`；否则 `'freeform'`。

把两条都写下来（哪个成立、不成立的那个为什么），因为 Task 4 的两个分支都要有测试。

- [ ] **Step 4: 把结论写回 spec（就地更正 §5 的开放项）**

在 spec 的"开放项"段落后面追加一段，格式照仓库既有惯例：**加粗日期 + 实测数字 + 结论**，例如：

> **更正（2026-10-26，Task 2 实测）**：`qb_question` 里 `type=4` 有 **N** 道，题干占位符与 `answer_json` 槽数一致的有 **M** 道 → `blankMode='counted'`（或 `'freeform'`）。真实样本 qid：**…**。同一次探针还取到：type=1 **…** 道、type=2 **…**、type=3 **…**、type=5 **…**（Task 15 的浏览器清单按这些 qid 点）。

- [ ] **Step 5: 提交（只有 spec 这一个文件）**

```bash
cd /f/AAAJAVA/code/EZ_frontend
git add -- docs/superpowers/specs/2026-10-26-practice-frontend-design.md
git commit -m "Task 2 探针：填空题占位符与题型分布实测，blankMode 定案" -- docs/superpowers/specs/2026-10-26-practice-frontend-design.md
```

探针文件留在仓库外（gitignored 的 tmp），不进提交。

---

## Task 3：`types.ts` —— 响应接口与 9 个形状校验

**Files:**
- Create: `src/api/practice/types.ts`, `src/api/practice/__tests__/fixtures.ts`, `src/api/practice/__tests__/types.spec.ts`

**Interfaces:**
- Consumes: `HttpError`（`src/api/request.ts`）
- Produces（后续任务的类型与校验入口，名字逐个钉死）：
  - 常量 `ANSWER_UNANSWERED=0`, `ANSWER_CORRECT=1`, `ANSWER_WRONG=2`, `ANSWER_PENDING=3`
  - 接口 `SubjectItem`, `QuestionOption`, `Question`, `QuestionItem`, `QuestionCurrent`, `StatDelta`, `AnswerSubmitResult`, `WrongItem`, `FavoriteItem`, `PageVO<T>`
  - 校验器 `parseSubjectList`, `parseQuestionPage`, `parseQuestionCurrent`, `parseAnswerSubmit`, `parseSelfJudge`, `parseWrongPage`, `parseFavoritePage`, `parseFavoriteToggle`, `parseMasterFlag`
  - 低层 `asObject`, `needNum`, `optNum`, `needStr`, `optStr`, `needBool`, `optBool`, `needArray`

- [ ] **Step 1: 写真实样本夹具**

```ts
// src/api/practice/__tests__/fixtures.ts
/** 逐字抄自端到端落盘字节（ezPracticeExercises/.qoder-cn/tmp/.../seg3/resp-*.json），不改一个字符 */
export const SUBJECT_LIST_OK = [
  { id: 1, name: '语文', subjectKey: 'chinese', icon: 'icon-chinese', description: '语文题库测试科目',
    questionCount: 4, myTotal: 10, myCorrect: 7, myAccuracy: 0.7, lastAnswerAt: 1792805141000 },
  { id: 2, name: '数学', subjectKey: 'math', icon: 'icon-math', description: '数学题库测试科目',
    questionCount: 3, myTotal: 2, myCorrect: 2, myAccuracy: 1.0, lastAnswerAt: 1792740125000 },
]

export const QUESTION_CURRENT_OK = {
  finished: false,
  question: {
    questionId: 7, subjectId: 2, type: 1, typeName: '单选题',
    title: '这是用户 bob 的私有题，哪个正确？',
    options: [
      { optionKey: 'A', content: '用户3选项A' }, { optionKey: 'B', content: '用户3选项B' },
      { optionKey: 'C', content: '用户3选项C' }, { optionKey: 'D', content: '用户3选项D' },
    ],
    difficulty: 1, tags: ['私有', '用户3'], index: 2, score: null,
  },
  answerStatus: 2, lastUserAnswerJson: '"A"', pendingRecordId: null,
}

export const QUESTION_CURRENT_FINISHED = {
  finished: true, question: null, answerStatus: null,
  lastUserAnswerJson: null, pendingRecordId: null,
}

export const SUBMIT_WRONG_OK = {
  recordId: 38, isCorrect: false, correctAnswerJson: '"C"', analysis: 'C 是正确选项。',
  needSelfJudge: false, statDelta: { total: 3, correct: 2, wrong: 1, accuracy: 0.67 },
  wrongCount: 1, wrongMastered: false,
}

export const SUBMIT_PENDING_OK = {
  recordId: 99, isCorrect: null, correctAnswerJson: '"我的简答"', analysis: '略',
  needSelfJudge: true, statDelta: { total: 4, correct: 2, wrong: 1, accuracy: 0.67 },
  wrongCount: 0, wrongMastered: false,
}

export const SELF_JUDGE_OK = { statDelta: { total: 11, correct: 8, wrong: 3, accuracy: 0.73 } }

export const WRONG_PAGE_OK = {
  pageNum: 1, pageSize: 20, total: 1, pages: 1,
  list: [{ questionId: 7, index: 2, type: 1, titleBrief: '这是用户 bob 的私有题，哪个正确？',
    wrongCount: 1, lastWrongAt: 1792811456000, status: 1, lastUserAnswerJson: '"A"' }],
}

export const WRONG_PAGE_EMPTY = { pageNum: 1, pageSize: 20, total: 0, pages: 0, list: [] }

export const FAVORITE_PAGE_OK = {
  pageNum: 1, pageSize: 20, total: 1, pages: 1,
  list: [{ questionId: 1, index: 1, type: 1, titleBrief: '下列选项中，正确的是？', createdAt: 1792811457000 }],
}

export const QUESTION_PAGE_OK = {
  pageNum: 1, pageSize: 100, total: 2, pages: 1,
  list: [
    { index: 1, questionId: 1, type: 1, difficulty: 1, tags: [], answerStatus: 0, favorited: false },
    { index: 2, questionId: 6, type: 5, difficulty: 2, tags: ['填空'], answerStatus: 3, favorited: true },
  ],
}

export const FAVORITE_TOGGLE_OK = { favorited: true }
```

- [ ] **Step 2: 写失败的测试**

```ts
// src/api/practice/__tests__/types.spec.ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../request'
import * as F from './fixtures'
import {
  parseAnswerSubmit, parseFavoritePage, parseFavoriteToggle, parseMasterFlag, parseQuestionCurrent,
  parseQuestionPage, parseSelfJudge, parseSubjectList, parseWrongPage,
} from '../types'

describe('parseSubjectList', () => {
  it('真实样本整条通过', () => {
    const got = parseSubjectList(F.SUBJECT_LIST_OK)
    expect(got.length).toBe(2)
    expect(got[0]).toMatchObject({ id: 1, name: '语文', questionCount: 4, myAccuracy: 0.7 })
    expect(got[1].lastAnswerAt).toBe(1792740125000)
  })

  it('不是数组就抛，且报文指出接口名', () => {
    expect(() => parseSubjectList({})).toThrowError(HttpError)
    expect(() => parseSubjectList({})).toThrow(/subject\/list/)
  })

  it('缺字段 / 改类型 / 塞 null 都抛', () => {
    const missing = [{ ...F.SUBJECT_LIST_OK[0], name: undefined }]
    expect(() => parseSubjectList(missing)).toThrow(/name/)
    expect(() => parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], questionCount: '4' }])).toThrow(/questionCount/)
    // myAccuracy 是不可空的 double
    expect(() => parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], myAccuracy: null }])).toThrow(/myAccuracy/)
  })

  it('lastAnswerAt 可空：null 与缺字段都留 null', () => {
    const got = parseSubjectList([{ ...F.SUBJECT_LIST_OK[0], lastAnswerAt: null }])
    expect(got[0].lastAnswerAt).toBeNull()
  })
})

describe('parseQuestionCurrent', () => {
  it('未做完的样本：题目、选项、上次作答都在', () => {
    const got = parseQuestionCurrent(F.QUESTION_CURRENT_OK)
    expect(got.finished).toBe(false)
    expect(got.question?.options.length).toBe(4)
    expect(got.answerStatus).toBe(2)
    expect(got.lastUserAnswerJson).toBe('"A"')
    expect(got.pendingRecordId).toBeNull()
  })

  it('finished 形态：question 与 answerStatus 都是 null，也必须通过', () => {
    const got = parseQuestionCurrent(F.QUESTION_CURRENT_FINISHED)
    expect(got.finished).toBe(true)
    expect(got.question).toBeNull()
    expect(got.answerStatus).toBeNull()
  })

  it('score 恒 null，不参与校验也不报错', () => {
    expect(parseQuestionCurrent(F.QUESTION_CURRENT_OK).question?.score).toBeNull()
  })

  it('选项少一个 optionKey → 抛', () => {
    const bad = { ...F.QUESTION_CURRENT_OK, question: {
      ...F.QUESTION_CURRENT_OK.question, options: [{ content: '只有内容' }],
    } }
    expect(() => parseQuestionCurrent(bad)).toThrow(/options/)
  })
})

describe('parseAnswerSubmit', () => {
  it('答错样本', () => {
    const got = parseAnswerSubmit(F.SUBMIT_WRONG_OK)
    expect(got.isCorrect).toBe(false)
    expect(got.statDelta).toEqual({ total: 3, correct: 2, wrong: 1, accuracy: 0.67 })
  })

  it('待自评样本：isCorrect 是 null 而不是 false', () => {
    const got = parseAnswerSubmit(F.SUBMIT_PENDING_OK)
    expect(got.isCorrect).toBeNull()
    expect(got.needSelfJudge).toBe(true)
  })

  it('statDelta 缺失 → 抛（它是"覆盖本地统计"的唯一依据，不能容错）', () => {
    const { statDelta, ...rest } = F.SUBMIT_WRONG_OK
    expect(() => parseAnswerSubmit(rest)).toThrow(/statDelta/)
  })
})

describe('分页三个 parse', () => {
  it('非空页', () => {
    expect(parseWrongPage(F.WRONG_PAGE_OK).list[0].questionId).toBe(7)
    expect(parseFavoritePage(F.FAVORITE_PAGE_OK).total).toBe(1)
    expect(parseQuestionPage(F.QUESTION_PAGE_OK).list[1].answerStatus).toBe(3)
  })

  it('空页：total=0 pages=0 list=[]', () => {
    const got = parseWrongPage(F.WRONG_PAGE_EMPTY)
    expect(got.list).toEqual([])
    expect(got.pages).toBe(0)
  })

  it('list 不是数组 → 抛', () => {
    expect(() => parseQuestionPage({ pageNum: 1, pageSize: 20, total: 0, pages: 0, list: null })).toThrow(/list/)
  })

  it('WrongItem 的可空字段（index/lastWrongAt/lastUserAnswerJson）允许 null', () => {
    const bare = { pageNum: 1, pageSize: 20, total: 1, pages: 1,
      list: [{ questionId: 1, index: null, type: 1, titleBrief: 'x',
        wrongCount: 1, lastWrongAt: null, status: 1, lastUserAnswerJson: null }] }
    expect(parseWrongPage(bare).list[0].index).toBeNull()
  })
})

describe('两个小 parse', () => {
  it('master 只认 boolean', () => {
    expect(parseMasterFlag(true)).toBe(true)
    expect(() => parseMasterFlag('true')).toThrowError(HttpError)
    expect(() => parseMasterFlag(null)).toThrowError(HttpError)
  })
  it('toggle 要 favorited', () => {
    expect(parseFavoriteToggle(F.FAVORITE_TOGGLE_OK).favorited).toBe(true)
    expect(() => parseFavoriteToggle({})).toThrow(/favorited/)
  })
  it('self-judge 要 statDelta', () => {
    expect(parseSelfJudge(F.SELF_JUDGE_OK).statDelta.total).toBe(11)
    expect(() => parseSelfJudge({})).toThrow(/statDelta/)
  })
})
```

- [ ] **Step 3: 跑，确认它红**

Run: `cd /f/AAAJAVA/code/EZ_frontend && npm run test:vitest -- src/api/practice/__tests__/types.spec.ts`
Expected: **FAIL — 找不到模块 `../types`**（贴真实报错，这是"先红"）。

- [ ] **Step 4: 实现 `types.ts`**

```ts
// src/api/practice/types.ts
/**
 * 练习侧 9 个接口的响应契约。字段逐个对齐后端 VO
 * （ezPracticeExercises/PracticeModule/.../pojo/vo/），可空性按真实语义。
 *
 * 为什么运行时校验：request<T> 的泛型是纯断言，编译期之后什么都不查。
 * 后端改字段名只会让页面把 undefined 渲染进答题卡 —— 那是"静默错"，
 * 而这里是唯一能在第一时间把它变成一条明确报文的地方。
 */
import { HttpError } from '../request'

export const ANSWER_UNANSWERED = 0
export const ANSWER_CORRECT = 1
export const ANSWER_WRONG = 2
export const ANSWER_PENDING = 3

export interface SubjectItem {
  id: number; name: string; subjectKey: string; icon: string; description: string;
  questionCount: number; myTotal: number; myCorrect: number;
  /** 0~1 的比值，两位小数 */
  myAccuracy: number;
  /** epoch 毫秒；未答过题时 null */
  lastAnswerAt: number | null;
}

export interface QuestionOption { optionKey: string; content: string }

export interface Question {
  questionId: number; subjectId: number; type: number; typeName: string; title: string;
  options: QuestionOption[]; difficulty: number | null; tags: string[];
  index: number | null;
  /** qb_question 没有 score 列，实测恒 null；不许依赖 */
  score: number | null;
}

export interface QuestionItem {
  /** 没有 title：后端在答题态刻意不给题干，题干只能从 question/current 拿 */
  index: number; questionId: number; type: number; difficulty: number | null;
  tags: string[]; answerStatus: number; favorited: boolean;
}

export interface QuestionCurrent {
  finished: boolean;
  question: Question | null;
  answerStatus: number | null;
  lastUserAnswerJson: string | null;
  /** 只有最近一条作答 answer_mode IN (1,3) 且 is_correct=-1 才非 null */
  pendingRecordId: number | null;
}

export interface StatDelta { total: number; correct: number; wrong: number; accuracy: number }

export interface AnswerSubmitResult {
  recordId: number;
  /** 待自评时是 null，不是 false */
  isCorrect: boolean | null;
  correctAnswerJson: string; analysis: string; needSelfJudge: boolean;
  /** 累计快照，不是增量 */
  statDelta: StatDelta;
  wrongCount: number; wrongMastered: boolean;
}

export interface WrongItem {
  questionId: number; index: number | null; type: number; titleBrief: string;
  wrongCount: number; lastWrongAt: number | null; status: number; lastUserAnswerJson: string | null;
}

export interface FavoriteItem {
  questionId: number; index: number | null; type: number; titleBrief: string; createdAt: number | null;
}

export interface PageVO<T> { pageNum: number; pageSize: number; total: number; pages: number; list: T[] }

type Obj = Record<string, unknown>

function shape(where: string, detail: string): never {
  throw new HttpError(`${where} 响应格式异常：${detail}`, 0)
}

function describeValue(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

export function asObject(value: unknown, where: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    shape(where, `期望对象，实得 ${describeValue(value)}`)
  }
  return value as Obj
}

export function needNum(o: Obj, key: string, where: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) shape(where, `${key} 期望数字，实得 ${describeValue(v)}`)
  return v as number
}

export function optNum(o: Obj, key: string, where: string): number | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v)) shape(where, `${key} 期望数字或 null，实得 ${describeValue(v)}`)
  return v as number
}

export function needStr(o: Obj, key: string, where: string): string {
  const v = o[key]
  if (typeof v !== 'string') shape(where, `${key} 期望字符串，实得 ${describeValue(v)}`)
  return v
}

export function optStr(o: Obj, key: string, where: string): string | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') shape(where, `${key} 期望字符串或 null，实得 ${describeValue(v)}`)
  return v
}

export function needBool(o: Obj, key: string, where: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') shape(where, `${key} 期望布尔，实得 ${describeValue(v)}`)
  return v
}

export function optBool(o: Obj, key: string, where: string): boolean | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'boolean') shape(where, `${key} 期望布尔或 null，实得 ${describeValue(v)}`)
  return v
}

export function needArray(o: Obj, key: string, where: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) shape(where, `${key} 期望数组，实得 ${describeValue(v)}`)
  return v
}

function parsePage(data: unknown, where: string): Omit<PageVO<unknown>, 'list'> & { rawList: unknown[] } {
  const o = asObject(data, where)
  return {
    pageNum: needNum(o, 'pageNum', where), pageSize: needNum(o, 'pageSize', where),
    total: needNum(o, 'total', where), pages: needNum(o, 'pages', where),
    rawList: needArray(o, 'list', where),
  }
}

function parseItemObject(value: unknown, where: string): Obj {
  return asObject(value, where)
}

export function parseSubjectList(data: unknown): SubjectItem[] {
  const where = 'GET /practice/subject/list'
  if (!Array.isArray(data)) shape(where, `期望数组，实得 ${describeValue(data)}`)
  return (data as unknown[]).map(raw => {
    const o = parseItemObject(raw, where)
    return {
      id: needNum(o, 'id', where), name: needStr(o, 'name', where),
      subjectKey: needStr(o, 'subjectKey', where), icon: needStr(o, 'icon', where),
      description: optStr(o, 'description', where) ?? '',
      questionCount: needNum(o, 'questionCount', where), myTotal: needNum(o, 'myTotal', where),
      myCorrect: needNum(o, 'myCorrect', where), myAccuracy: needNum(o, 'myAccuracy', where),
      lastAnswerAt: optNum(o, 'lastAnswerAt', where),
    }
  })
}

function parseQuestion(value: unknown, where: string): Question {
  const o = parseItemObject(value, where)
  const options = needArray(o, 'options', where).map(raw => {
    const x = parseItemObject(raw, `${where}.options`)
    return { optionKey: needStr(x, 'optionKey', `${where}.options`), content: needStr(x, 'content', `${where}.options`) }
  })
  return {
    questionId: needNum(o, 'questionId', where), subjectId: needNum(o, 'subjectId', where),
    type: needNum(o, 'type', where), typeName: needStr(o, 'typeName', where),
    title: needStr(o, 'title', where), options,
    difficulty: optNum(o, 'difficulty', where),
    tags: (needArray(o, 'tags', where) as unknown[]).map(t => {
      if (typeof t !== 'string') shape(where, 'tags 的元素期望字符串')
      return t
    }),
    index: optNum(o, 'index', where), score: optNum(o, 'score', where),
  }
}

export function parseQuestionPage(data: unknown): PageVO<QuestionItem> {
  const where = 'GET /practice/question/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = parseItemObject(raw, where)
    return {
      index: needNum(o, 'index', where), questionId: needNum(o, 'questionId', where),
      type: needNum(o, 'type', where), difficulty: optNum(o, 'difficulty', where),
      tags: needArray(o, 'tags', where) as string[],
      answerStatus: needNum(o, 'answerStatus', where), favorited: needBool(o, 'favorited', where),
    }
  })
  return { pageNum: page.pageNum, pageSize: page.pageSize, total: page.total, pages: page.pages, list }
}

export function parseQuestionCurrent(data: unknown): QuestionCurrent {
  const where = 'GET /practice/question/current'
  const o = asObject(data, where)
  const finished = needBool(o, 'finished', where)
  const rawQuestion = o.question
  if (rawQuestion !== null && rawQuestion !== undefined && typeof rawQuestion !== 'object') {
    shape(where, `question 期望对象或 null，实得 ${describeValue(rawQuestion)}`)
  }
  return {
    finished,
    question: rawQuestion ? parseQuestion(rawQuestion, where) : null,
    answerStatus: optNum(o, 'answerStatus', where),
    lastUserAnswerJson: optStr(o, 'lastUserAnswerJson', where),
    pendingRecordId: optNum(o, 'pendingRecordId', where),
  }
}

function parseStatDelta(value: unknown, where: string): StatDelta {
  const o = parseItemObject(value, where)
  return {
    total: needNum(o, 'total', where), correct: needNum(o, 'correct', where),
    wrong: needNum(o, 'wrong', where), accuracy: needNum(o, 'accuracy', where),
  }
}

export function parseAnswerSubmit(data: unknown): AnswerSubmitResult {
  const where = 'POST /practice/answer/submit'
  const o = asObject(data, where)
  return {
    recordId: needNum(o, 'recordId', where),
    isCorrect: optBool(o, 'isCorrect', where),
    correctAnswerJson: needStr(o, 'correctAnswerJson', where),
    analysis: optStr(o, 'analysis', where) ?? '',
    needSelfJudge: needBool(o, 'needSelfJudge', where),
    statDelta: parseStatDelta(o.statDelta, where),
    wrongCount: needNum(o, 'wrongCount', where),
    wrongMastered: needBool(o, 'wrongMastered', where),
  }
}

export function parseSelfJudge(data: unknown): { statDelta: StatDelta } {
  const where = 'POST /practice/answer/self-judge'
  const o = asObject(data, where)
  return { statDelta: parseStatDelta(o.statDelta, where) }
}

export function parseWrongPage(data: unknown): PageVO<WrongItem> {
  const where = 'GET /practice/wrong/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = parseItemObject(raw, where)
    return {
      questionId: needNum(o, 'questionId', where), index: optNum(o, 'index', where),
      type: needNum(o, 'type', where), titleBrief: needStr(o, 'titleBrief', where),
      wrongCount: needNum(o, 'wrongCount', where), lastWrongAt: optNum(o, 'lastWrongAt', where),
      status: needNum(o, 'status', where), lastUserAnswerJson: optStr(o, 'lastUserAnswerJson', where),
    }
  })
  return { pageNum: page.pageNum, pageSize: page.pageSize, total: page.total, pages: page.pages, list }
}

export function parseFavoritePage(data: unknown): PageVO<FavoriteItem> {
  const where = 'GET /practice/favorite/page'
  const page = parsePage(data, where)
  const list = page.rawList.map(raw => {
    const o = parseItemObject(raw, where)
    return {
      questionId: needNum(o, 'questionId', where), index: optNum(o, 'index', where),
      type: needNum(o, 'type', where), titleBrief: needStr(o, 'titleBrief', where),
      createdAt: optNum(o, 'createdAt', where),
    }
  })
  return { pageNum: page.pageNum, pageSize: page.pageSize, total: page.total, pages: page.pages, list }
}

export function parseFavoriteToggle(data: unknown): { favorited: boolean } {
  const where = 'POST /practice/favorite/toggle'
  return { favorited: needBool(asObject(data, where), 'favorited', where) }
}

/** Result<Boolean>：data 本身就是布尔 */
export function parseMasterFlag(data: unknown): boolean {
  const where = 'POST /practice/wrong/master'
  if (typeof data !== 'boolean') shape(where, `期望布尔，实得 ${describeValue(data)}`)
  return data
}
```

- [ ] **Step 5: 跑，确认绿**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm run test:vitest -- src/api/practice/__tests__/types.spec.ts && npm run type-check
```

**不许为了让 `expect(...).toThrow(/name/)` 通过而把报文写成不含字段名**。如果某条断言与 `shape()` 的措辞打架，改实现、别放水。

- [ ] **Step 6: 就地更正 spec 的文件清单**

spec §2 里 `types.ts` 那行原本包含 `encodeUserAnswer / normalizePage / errorText / createSeqGuard`。改成只写"响应接口 + answerStatus 常量 + 形状校验"，并把其余四个补成 `answer.ts` / `paging.ts` / `errors.ts` / `http.ts` 四行。附一句：**"拆分原因：四件事的变化原因不同（契约 / 题目语义 / 视图口径 / 请求管道），塞一个文件迟早长成一个 400 行的杂物袋。"**

- [ ] **Step 7: 提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend
git add -- src/api/practice docs/superpowers/specs/2026-10-26-practice-frontend-design.md
git commit -m "练习侧响应契约：types.ts 的 9 个形状校验 + 真实样本夹具（逐字抄端到端字节）" -- src/api/practice docs/superpowers/specs/2026-10-26-practice-frontend-design.md
```

---

## Task 4：`answer.ts` —— 编解码、答题卡四态、自评判据

**Files:**
- Create: `src/api/practice/answer.ts`, `src/api/practice/__tests__/answer.spec.ts`

**Interfaces:**
- Consumes: `AnswerSubmitResult`（Task 3）
- Produces:
  - `TYPE_SINGLE=1, TYPE_MULTI=2, TYPE_JUDGE=3, TYPE_BLANK=4, TYPE_ESSAY=5`
  - `type AnswerValue = string | string[] | boolean | null`
  - `encodeUserAnswer(type: number, value: AnswerValue): string`
  - `decodeUserAnswer(type: number, json: string | null): AnswerValue`
  - `type CardState = 'idle' | 'correct' | 'wrong' | 'pending'`
  - `cardState(status: number | null): CardState`
  - `cardStateAfterSubmit(r: AnswerSubmitResult): CardState`
  - `canSelfJudge(status: number | null, pendingRecordId: number | null): boolean`
  - `clampDuration(ms: number): number`
  - `BLANK_MODE: 'counted' | 'freeform'`（Task 2 Step 3 定值）、`blankSlots(title: string): string[] | null`

- [ ] **Step 1: 写失败的测试**

```ts
// src/api/practice/__tests__/answer.spec.ts
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../request'
import * as F from './fixtures'
import { parseAnswerSubmit } from '../types'
import {
  BLANK_MODE, blankSlots, canSelfJudge, cardState, cardStateAfterSubmit, clampDuration,
  decodeUserAnswer, encodeUserAnswer, TYPE_BLANK, TYPE_ESSAY, TYPE_JUDGE, TYPE_MULTI, TYPE_SINGLE,
} from '../answer'

describe('encodeUserAnswer：输出是整份 JSON 的文本', () => {
  it('单选 → "A"（含引号）', () => {
    expect(encodeUserAnswer(TYPE_SINGLE, 'A')).toBe('"A"')
  })
  it('多选 → 归一排序', () => {
    expect(encodeUserAnswer(TYPE_MULTI, ['B', 'A'])).toBe('["A","B"]')
  })
  it('判断 → true / false', () => {
    expect(encodeUserAnswer(TYPE_JUDGE, true)).toBe('true')
    expect(encodeUserAnswer(TYPE_JUDGE, false)).toBe('false')
  })
  it('填空 → 空位保留为 ""，逐个 trim', () => {
    expect(encodeUserAnswer(TYPE_BLANK, [' apple ', ''])).toBe('["apple",""]')
  })
  it('简答 → 整段字符串', () => {
    expect(encodeUserAnswer(TYPE_ESSAY, '我的作答')).toBe('"我的作答"')
  })
  it('空作答一律抛，绝不发 ""：后端 "答案不能为空" 是 40000', () => {
    expect(() => encodeUserAnswer(TYPE_SINGLE, '')).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_MULTI, [])).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_BLANK, ['', '   '])).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_ESSAY, '   ')).toThrowError(HttpError)
    expect(() => encodeUserAnswer(TYPE_JUDGE, null)).toThrowError(HttpError)
  })
  it('未知题型抛，不返回 undefined', () => {
    expect(() => encodeUserAnswer(99, 'A')).toThrow(/未知题型/)
  })
  it('编码结果必须是单值 JSON 文档（后端严格 parse，多值会被 MySQL 拒）', () => {
    const encoded = encodeUserAnswer(TYPE_SINGLE, 'A')
    expect(() => JSON.parse(encoded + ' "B"')).toThrow()   // 夹具自检：拼接后就不是合法文档
    expect(JSON.parse(encoded)).toBe('A')
  })
})

describe('decodeUserAnswer：坏数据打死不回', () => {
  it('五题型正向', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '"A"')).toBe('A')
    expect(decodeUserAnswer(TYPE_MULTI, '["A","B"]')).toEqual(['A', 'B'])
    expect(decodeUserAnswer(TYPE_JUDGE, 'true')).toBe(true)
    expect(decodeUserAnswer(TYPE_BLANK, '["a",""]')).toEqual(['a', ''])
    expect(decodeUserAnswer(TYPE_ESSAY, '"我的作答"')).toBe('我的作答')
  })
  it('null / 空串 → null', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, null)).toBeNull()
    expect(decodeUserAnswer(TYPE_SINGLE, '')).toBeNull()
  })
  it('畸形 JSON → null 而不是抛（回填失败不能挡住答题页）', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '{坏掉了')).toBeNull()
  })
  it('类型不符 → null', () => {
    expect(decodeUserAnswer(TYPE_SINGLE, '3')).toBeNull()
    expect(decodeUserAnswer(TYPE_MULTI, '"A"')).toBeNull()
    expect(decodeUserAnswer(TYPE_JUDGE, '"true"')).toBeNull()
    expect(decodeUserAnswer(TYPE_ESSAY, ['A'] as unknown as string)).toBeNull()
  })
})

describe('答题卡四态', () => {
  it('answerStatus → 态', () => {
    expect(cardState(0)).toBe('idle')
    expect(cardState(1)).toBe('correct')
    expect(cardState(2)).toBe('wrong')
    expect(cardState(3)).toBe('pending')
    expect(cardState(null)).toBe('idle')
  })
  it('提交后迁移：待自评优先于 isCorrect（那一刻它是 null，不是 false）', () => {
    expect(cardStateAfterSubmit(parseAnswerSubmit(F.SUBMIT_WRONG_OK))).toBe('wrong')
    expect(cardStateAfterSubmit(parseAnswerSubmit(F.SUBMIT_PENDING_OK))).toBe('pending')
  })
})

describe('canSelfJudge：闸门要两个条件同时成立', () => {
  it('3 + pendingRecordId → 可以', () => expect(canSelfJudge(3, 22)).toBe(true))
  it('3 + null（考试来源的题）→ 不可以', () => expect(canSelfJudge(3, null)).toBe(false))
  it('非 3 一律不可以', () => {
    expect(canSelfJudge(2, 22)).toBe(false)
    expect(canSelfJudge(0, null)).toBe(false)
    expect(canSelfJudge(null, 22)).toBe(false)
  })
})

describe('clampDuration：后端拒负数', () => {
  it('负数归 0，正常值原样', () => {
    expect(clampDuration(-5000)).toBe(0)
    expect(clampDuration(1200)).toBe(1200)
    expect(clampDuration(Number.NaN)).toBe(0)
  })
})

describe('blankSlots：填空槽数的唯一来源', () => {
  it('BLANK_MODE 必须是 Task 2 定下的两个值之一', () => {
    expect(['counted', 'freeform']).toContain(BLANK_MODE)
  })

  // 数不出来就回 null，让调用方退回自由文本 —— 这条在两种模式下都必须成立，
  // 它的真实价值是钉住"数不出来时不许猜一个槽数"（猜错就是答案长度错，后端逐位比对会静默判错）
  it('没有占位符 → null', () => {
    expect(blankSlots('这是一道没有占位符的题干')).toBeNull()
  })

  it.skipIf(BLANK_MODE !== 'counted')('counted：两个下划线占位符 → 两个空槽', () => {
    expect(blankSlots('根据内容填空：___ 与 ___ 。')).toEqual(['', ''])
  })

  it.skipIf(BLANK_MODE !== 'counted')('counted：括号形态的占位符也算', () => {
    expect(blankSlots('填（ ）和 ( )')).toEqual(['', ''])
  })

  it.skipIf(BLANK_MODE !== 'freeform')('freeform：一律 null，槽数交给单框按行切', () => {
    expect(blankSlots('根据内容填空：___ 与 ___ 。')).toBeNull()
  })
})
```

`BLANK_MODE` 是 `'counted'` 还是 `'freeform'` 由 Task 2 的实测决定，**两条 `skipIf` 分支会有一条自动跳过 —— 这不是放水，是把"按实测二选一"这件事写进测试文件本身**；定案后请回填一条注释说明哪几条当时被跳过。

- [ ] **Step 2: 跑，确认红（找不到 `../answer`）**

Run: `npm run test:vitest -- src/api/practice/__tests__/answer.spec.ts`

- [ ] **Step 3: 实现 `answer.ts`**

```ts
// src/api/practice/answer.ts
/**
 * 题目语义层：作答值 ↔ 上送的 JSON 文本、answerStatus ↔ 答题卡四态、自评闸门判据。
 *
 * 这里的 encode 是全模块**唯一**能产出 userAnswerJson 的地方。
 * 后端把它直写 MySQL json 列，并用严格 parse 拒多值文档与非有限数
 * （段 2 的独立审查就是抓在这个上面），所以字符串绝不能在别处手工拼。
 */
import { HttpError } from '../request'
import type { AnswerSubmitResult } from './types'

export const TYPE_SINGLE = 1
export const TYPE_MULTI = 2
export const TYPE_JUDGE = 3
export const TYPE_BLANK = 4
export const TYPE_ESSAY = 5

export type AnswerValue = string | string[] | boolean | null

/** Task 2 的实测结论（counted=题干占位符数等于答案槽数；freeform=数不出来）。 */
export const BLANK_MODE: 'counted' | 'freeform' = 'counted'   // ← Task 2 Step 3 定值，两分支都要留着

const BLANK_MARKER = /_{2,}|（\s*）|\(\s*\)/g

/** counted 模式给出与槽数等长的空数组；数不出来返回 null，调用方退回自由文本。 */
export function blankSlots(title: string): string[] | null {
  if (BLANK_MODE !== 'counted') return null
  const found = title.match(BLANK_MARKER)
  return found && found.length ? found.map(() => '') : null
}

export function encodeUserAnswer(type: number, value: AnswerValue): string {
  switch (type) {
    case TYPE_SINGLE:
      if (typeof value !== 'string' || !value) throw new HttpError('单选题需要选择一个选项', 0)
      return JSON.stringify(value)
    case TYPE_MULTI: {
      if (!Array.isArray(value) || value.length === 0) throw new HttpError('多选题至少选择一个选项', 0)
      if (!value.every(v => typeof v === 'string' && v)) throw new HttpError('多选题的选项键不合法', 0)
      return JSON.stringify([...value].sort())
    }
    case TYPE_JUDGE:
      if (typeof value !== 'boolean') throw new HttpError('判断题需要选择"对"或"错"', 0)
      return JSON.stringify(value)
    case TYPE_BLANK: {
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        throw new HttpError('填空题答案格式不合法', 0)
      }
      const trimmed = value.map(v => v.trim())
      if (!trimmed.some(v => v)) throw new HttpError('填空题至少填一个空', 0)
      return JSON.stringify(trimmed)
    }
    case TYPE_ESSAY:
      if (typeof value !== 'string' || !value.trim()) throw new HttpError('简答题请先作答', 0)
      return JSON.stringify(value.trim())
    default:
      throw new HttpError(`未知题型 ${String(type)}`, 0)
  }
}

export function decodeUserAnswer(type: number, json: string | null): AnswerValue {
  if (json === null || json === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
  switch (type) {
    case TYPE_SINGLE:
      return typeof parsed === 'string' && parsed ? parsed : null
    case TYPE_MULTI:
      return strings(parsed) && parsed.length ? parsed : null
    case TYPE_JUDGE:
      return typeof parsed === 'boolean' ? parsed : null
    case TYPE_BLANK:
      return strings(parsed) ? parsed : null
    case TYPE_ESSAY:
      return typeof parsed === 'string' ? parsed : null
    default:
      return null
  }
}

export type CardState = 'idle' | 'correct' | 'wrong' | 'pending'

export function cardState(status: number | null): CardState {
  switch (status) {
    case 1: return 'correct'
    case 2: return 'wrong'
    case 3: return 'pending'
    default: return 'idle'
  }
}

export function cardStateAfterSubmit(r: AnswerSubmitResult): CardState {
  if (r.needSelfJudge) return 'pending'
  return r.isCorrect ? 'correct' : 'wrong'
}

export function canSelfJudge(status: number | null, pendingRecordId: number | null): boolean {
  return status === 3 && pendingRecordId !== null
}

export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.round(ms)
}
```

`decodeUserAnswer(TYPE_ESSAY, ['A'])` 那条测试传的是非字符串 —— 实现里 `typeof parsed === 'string'` 就把它接住了；**别为了过测试给 `decode` 加 try 之外的兜底**。

- [ ] **Step 4: 跑，确认绿 + type-check 绿**

Run: `npm run test:vitest -- src/api/practice/__tests__/answer.spec.ts && npm run type-check`

- [ ] **Step 5: 提交**

```bash
git add -- src/api/practice/answer.ts src/api/practice/__tests__/answer.spec.ts
git commit -m "题目语义层：encode 只此一处、答题卡四态、自评闸门判据、空作答先在前端拦住" -- src/api/practice/answer.ts src/api/practice/__tests__/answer.spec.ts
```

---

## Task 5：`http.ts` / `paging.ts` / `errors.ts` —— 请求管道、分页口径、错误文案

**Files:**
- Create: `src/api/practice/http.ts`, `src/api/practice/paging.ts`, `src/api/practice/errors.ts`, `src/utils/datetime.ts`
- Test: `src/api/practice/__tests__/{http,paging,errors}.spec.ts`

**Interfaces:**
- Consumes: `AuthError`, `BizError`, `HttpError`（`src/api/request.ts`）；`PageVO`（Task 3）
- Produces:
  - `buildQuery(params: Record<string, string | number | boolean | null | undefined>): string`
  - `createSeqGuard(): { next(): number; isCurrent(token: number): boolean }`
  - `PAGE_SIZE_MAX=100`, `DEFAULT_PAGE_SIZE=20`, `clampPageSize(n?: number|null): number`
  - `interface PageView<T> extends PageVO<T> { hasPrev: boolean; hasNext: boolean }`、`normalizePage<T>(vo: PageVO<T>): PageView<T>`
  - `errorText(err: unknown): string | null`
  - `formatDateTime(ms: number | null): string`

- [ ] **Step 1: 写三份失败的测试**

```ts
// src/api/practice/__tests__/http.spec.ts
import { describe, expect, it } from 'vitest'
import { buildQuery, createSeqGuard } from '../http'

describe('buildQuery', () => {
  it('跳过 null / undefined / 空串：subjectId 与 questionId 互斥靠这个保证', () => {
    expect(buildQuery({ subjectId: 1, mode: undefined, questionId: null })).toBe('?subjectId=1')
  })
  it('空串同样跳过（"?questionId=" 这种半截参数会被后端 40000 拒）', () => {
    expect(buildQuery({ subjectId: '', questionId: 7 })).toBe('?questionId=7')
  })
  it('没有参数时回空串，不发出 "?"', () => {
    expect(buildQuery({})).toBe('')
  })
  it('数字与布尔都转字符串并做 URL 编码', () => {
    expect(buildQuery({ a: 1, b: true, c: 'x y' })).toBe('?a=1&b=true&c=x%20y')
  })
})

describe('createSeqGuard：切科目的竞态', () => {
  it('后发先至：旧 token 的迟到响应必须被判为过期', () => {
    const g = createSeqGuard()
    const first = g.next()
    const second = g.next()
    expect(g.isCurrent(first)).toBe(false)
    expect(g.isCurrent(second)).toBe(true)
  })
  it('没发过请求时任何 token 都不算当前', () => {
    expect(createSeqGuard().isCurrent(1)).toBe(false)
  })
})
```

那两条"跳过"的断言就是这条函数存在的理由：`question/current` 同时收到 `subjectId` 与 `questionId` 会被后端 40000 拒（事实清单 3/9）。

```ts
// src/api/practice/__tests__/paging.spec.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_MAX, clampPageSize, normalizePage } from '../paging'

describe('clampPageSize：后端超 100 直接 40000', () => {
  it('夹到上限、非法值回默认', () => {
    expect(PAGE_SIZE_MAX).toBe(100)
    expect(DEFAULT_PAGE_SIZE).toBe(20)
    expect(clampPageSize(101)).toBe(100)
    expect(clampPageSize(0)).toBe(20)
    expect(clampPageSize(-5)).toBe(20)
    expect(clampPageSize(null)).toBe(20)
    expect(clampPageSize(undefined)).toBe(20)
    expect(clampPageSize(15.5)).toBe(15)
  })
})

describe('normalizePage：越界页的真相是 total，不是空 list', () => {
  it('第 1 页有数据', () => {
    const got = normalizePage({ pageNum: 1, pageSize: 20, total: 21, pages: 2, list: [1] })
    expect(got.hasPrev).toBe(false)
    expect(got.hasNext).toBe(true)
  })
  it('最后一页', () => {
    const got = normalizePage({ pageNum: 2, pageSize: 20, total: 21, pages: 2, list: [1] })
    expect(got.hasNext).toBe(false)
    expect(got.hasPrev).toBe(true)
  })
  it('越界页：list 空但 pages 说明还有题 → hasNext 仍按 pages 判', () => {
    const got = normalizePage({ pageNum: 3, pageSize: 20, total: 21, pages: 2, list: [] })
    expect(got.hasNext).toBe(false)
    expect(got.hasPrev).toBe(true)
    expect(got.total).toBe(21)
  })
  it('空库：pages=0 → 两个方向都 false', () => {
    const got = normalizePage({ pageNum: 1, pageSize: 20, total: 0, pages: 0, list: [] })
    expect(got.hasPrev).toBe(false)
    expect(got.hasNext).toBe(false)
  })
})
```

```ts
// src/api/practice/__tests__/errors.spec.ts
import { describe, expect, it } from 'vitest'
import { AuthError, BizError, HttpError } from '../../request'
import { errorText } from '../errors'

describe('errorText：语义唯一的码用固定文案，多义的码用后端中文', () => {
  it('40000 展示后端 msg（一模多义，映射表会把信息丢掉）', () => {
    expect(errorText(new BizError('subjectId 与 questionId 只能给一个', 40000)))
      .toBe('subjectId 与 questionId 只能给一个')
  })
  it('40900 展示后端 msg（下架/停用/已自评三义）', () => {
    expect(errorText(new BizError('题目已下架', 40900))).toBe('题目已下架')
  })
  it('40100 / 40300 / 40400 用固定文案', () => {
    expect(errorText(new BizError('用户身份不存在，请重新登录', 40100))).toBe('登录状态异常，请重新登录')
    expect(errorText(new BizError('无权操作该作答', 40300))).toBe('无权操作该作答')
    expect(errorText(new BizError('题目不存在', 40400))).toBe('内容可能已更新，请刷新重试')
  })
  it('未知码回落后端 msg，msg 空再回落到带码的通用文案', () => {
    expect(errorText(new BizError('别的说法', 49999))).toBe('别的说法')
    expect(errorText(new BizError('', 49999))).toBe('操作失败（49999）')
  })
  it('AuthError 不渲染：跳登录由 request.ts 的收口负责', () => {
    expect(errorText(new AuthError('登录状态已失效', 401))).toBeNull()
  })
  it('HttpError 原样给文案（网关没起是最常见的真实故障，这句话要留着）', () => {
    expect(errorText(new HttpError('无法连接服务器，请确认网关已启动', 0)))
      .toBe('无法连接服务器，请确认网关已启动')
    expect(errorText(new HttpError('GET /practice/subject/list 响应格式异常：name 期望字符串', 0)))
      .toContain('subject/list')
  })
  it('不是三种 Error 的东西也不崩', () => {
    expect(errorText('字符串')).toBe('出现了未预期的问题，请稍后重试')
    expect(errorText(undefined)).toBe('出现了未预期的问题，请稍后重试')
  })
})
```

- [ ] **Step 2: 跑，确认三份都红**

Run: `npm run test:vitest -- src/api/practice/__tests__/http.spec.ts`（另两份同法）。贴真实报错。

- [ ] **Step 3: 实现 `http.ts`**

```ts
// src/api/practice/http.ts
/** 请求管道层的两个小工具：query 串拼装与"过期响应丢弃"。 */

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    // 空串也跳：question/current 的 subjectId/questionId 互斥，
    // 传了空值就是"两个都给了"，后端一律 40000。
    if (value === null || value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

export interface SeqGuard {
  next(): number
  isCurrent(token: number): boolean
}

/**
 * 切科目 / 切模式 / 翻页都会让在途请求过期，而 request.ts 不接受 AbortSignal。
 * 所以用序号判定：回来的那张票不是最新就整条丢掉（不写状态、不清 loading）。
 */
export function createSeqGuard(): SeqGuard {
  let seq = 0
  return {
    next: () => ++seq,
    isCurrent: (token: number) => token === seq,
  }
}
```

- [ ] **Step 4: 实现 `paging.ts`**

```ts
// src/api/practice/paging.ts
import type { PageVO } from './types'

/** 后端 PracticePages 的硬上限：超过直接 40000，所以宁可前端夹住。 */
export const PAGE_SIZE_MAX = 100
export const DEFAULT_PAGE_SIZE = 20

export function clampPageSize(size?: number | null): number {
  if (size === null || size === undefined || !Number.isFinite(size)) return DEFAULT_PAGE_SIZE
  const int = Math.floor(size)
  if (int <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(int, PAGE_SIZE_MAX)
}

export interface PageView<T> extends PageVO<T> {
  hasPrev: boolean
  hasNext: boolean
}

/**
 * 越界页后端照回"真 total + 空 list"（QuestionReadServiceImpl:69-72），
 * 所以两个方向的判据都只看 pageNum/pages，绝不能看 list 长度。
 */
export function normalizePage<T>(vo: PageVO<T>): PageView<T> {
  return {
    ...vo,
    hasPrev: vo.pageNum > 1,
    hasNext: vo.pages > 0 && vo.pageNum < vo.pages,
  }
}
```

- [ ] **Step 5: 实现 `errors.ts`**

```ts
// src/api/practice/errors.ts
import { AuthError, BizError, HttpError } from '../request'

/** 语义唯一的码 → 固定文案（后端 msg 三种缺失语义不可分辨时，固定文案更诚实） */
const FIXED: Record<number, string> = {
  40100: '登录状态异常，请重新登录',
  40300: '无权操作该作答',
  40400: '内容可能已更新，请刷新重试',
}

/** 一模多义的码：后端中文 msg 才带得出具体原因，直接展示 */
const SHOW_BACKEND_MESSAGE = new Set([40000, 40900])

export function errorText(err: unknown): string | null {
  // 401/403 由 request.ts 触发跳登录，页面再挂一条错误条就是错内容
  if (err instanceof AuthError) return null
  if (err instanceof BizError) {
    if (SHOW_BACKEND_MESSAGE.has(err.code)) return err.message || `操作失败（${err.code}）`
    const fixed = FIXED[err.code]
    if (fixed) return fixed
    return err.message || `操作失败（${err.code}）`
  }
  if (err instanceof HttpError) return err.message
  return '出现了未预期的问题，请稍后重试'
}
```

- [ ] **Step 6: 实现 `src/utils/datetime.ts`**

```ts
// src/utils/datetime.ts
/** 接口给的是 epoch 毫秒；未作答/无记录时后端给 null，这里回占位符而不是 1970。 */
const FALLBACK = '—'

export function formatDateTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return FALLBACK
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms))
}
```

配一条 spec（`src/utils/__tests__/datetime.spec.ts`）：`formatDateTime(null) === '—'`、`formatDateTime(Number.NaN) === '—'`、`formatDateTime(1792805141000)` 含年份 `2026`。**断言别写死完整串**（`Intl` 结果随 locale 变），只断言包含数字片段。

- [ ] **Step 7: 四份都绿 + type-check 绿**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm run test:vitest && npm run type-check
```

- [ ] **Step 8: 提交**

```bash
git add -- src/api/practice src/utils
git commit -m "请求管道、分页口径与错误文案：越界页看 pages、401 不渲染错误条、pageSize 先夹住" -- src/api/practice src/utils
```

---

## Task 6：`api/practice/` 的三个取数文件 + fetch 打桩的集成 spec

**Files:**
- Create: `src/api/practice/subject.ts`, `src/api/practice/question.ts`, `src/api/practice/wrongFavorite.ts`
- Test: `src/api/practice/__tests__/api.spec.ts`

**Interfaces:**
- Consumes: `request`（`src/api/request.ts`）、Task 3 的 9 个 parse、Task 5 的 `buildQuery`
- Produces（composables 只认这些名字）：
  - `fetchSubjects(): Promise<SubjectItem[]>`
  - `fetchQuestionPage(q: { subjectId: number; pageNum?: number; pageSize?: number }): Promise<PageVO<QuestionItem>>`
  - `fetchCurrent(q: { subjectId?: number; mode?: 1 | 3; questionId?: number }): Promise<QuestionCurrent>`
  - `submitAnswer(f: SubmitForm): Promise<AnswerSubmitResult>`，`SubmitForm = { subjectId: number; questionId: number; userAnswerJson: string; durationMs: number; mode: 1 | 3 }`
  - `selfJudge(f: { subjectId: number; questionId: number; recordId: number; isCorrect: boolean }): Promise<StatDelta>`
  - `fetchWrongPage(q: { subjectId: number; status?: 1 | 2; pageNum?: number; pageSize?: number }): Promise<PageVO<WrongItem>>`
  - `markMastered(questionId: number): Promise<boolean>`
  - `fetchFavoritePage(q: { subjectId: number; pageNum?: number; pageSize?: number }): Promise<PageVO<FavoriteItem>>`
  - `toggleFavorite(subjectId: number, questionId: number): Promise<boolean>`

- [ ] **Step 1: 写失败的集成 spec（打桩 `globalThis.fetch`，不 mock 模块）**

```ts
// src/api/practice/__tests__/api.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BizError, HttpError } from '../../request'
import * as F from './fixtures'
import { fetchCurrent, fetchQuestionPage, selfJudge, submitAnswer } from '../question'
import { fetchSubjects } from '../subject'
import { fetchFavoritePage, fetchWrongPage, markMastered, toggleFavorite } from '../wrongFavorite'

let calls: { url: string; init?: RequestInit }[] = []

function respond(data: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ code: 1, msg: 'success', data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

beforeEach(() => { calls = [] })
afterEach(() => { vi.unstubAllGlobals() })

describe('GET 拼URL', () => {
  it('subject/list 不带 query', async () => {
    respond(F.SUBJECT_LIST_OK)
    const got = await fetchSubjects()
    expect(calls[0].url).toBe('/gw/practice/subject/list')
    expect(got[0].name).toBe('语文')
  })

  it('question/page 三个参数都进 query', async () => {
    respond(F.QUESTION_PAGE_OK)
    await fetchQuestionPage({ subjectId: 1, pageNum: 2, pageSize: 100 })
    expect(calls[0].url).toBe('/gw/practice/question/page?subjectId=1&pageNum=2&pageSize=100')
  })

  it('current 只给 questionId：subjectId 绝不出现（同时给会被后端 40000 拒）', async () => {
    respond(F.QUESTION_CURRENT_OK)
    await fetchCurrent({ questionId: 7 })
    expect(calls[0].url).toBe('/gw/practice/question/current?questionId=7')
  })

  it('current 给 subjectId+mode=3', async () => {
    respond(F.QUESTION_CURRENT_OK)
    await fetchCurrent({ subjectId: 2, mode: 3 })
    expect(calls[0].url).toBe('/gw/practice/question/current?subjectId=2&mode=3')
  })

  it('wrong/page 省略 status 时不带 status=', async () => {
    respond(F.WRONG_PAGE_OK)
    await fetchWrongPage({ subjectId: 1 })
    expect(calls[0].url).toBe('/gw/practice/wrong/page?subjectId=1&pageNum=1&pageSize=20')
  })
})

describe('POST 带上 JSON body', () => {
  it('submit 的 body 就是后端 DTO 的五个键', async () => {
    respond(F.SUBMIT_WRONG_OK)
    const got = await submitAnswer({
      subjectId: 2, questionId: 7, userAnswerJson: '"A"', durationMs: 1200, mode: 1,
    })
    expect(calls[0].url).toBe('/gw/practice/answer/submit')
    expect(calls[0].init?.method ?? 'POST').toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      subjectId: 2, questionId: 7, userAnswerJson: '"A"', durationMs: 1200, mode: 1,
    })
    expect(got.statDelta.total).toBe(3)
  })

  it('self-judge 返回 statDelta 本体（不是整个 data）', async () => {
    respond(F.SELF_JUDGE_OK)
    const got = await selfJudge({ subjectId: 1, questionId: 6, recordId: 22, isCorrect: true })
    expect(got).toEqual(F.SELF_JUDGE_OK.statDelta)
  })

  it('master 只有 questionId 一个键', async () => {
    respond(true)
    expect(await markMastered(7)).toBe(true)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ questionId: 7 })
  })

  it('toggle 回 favorited 布尔本体', async () => {
    respond(F.FAVORITE_TOGGLE_OK)
    expect(await toggleFavorite(1, 1)).toBe(true)
  })
})

describe('信封与校验都在路上', () => {
  it('code!=1 → BizError，带原始 code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 40000, msg: 'subjectId 与 questionId 只能给一个', data: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(fetchCurrent({ subjectId: 1, questionId: 7 })).rejects.toBeInstanceOf(BizError)
  })

  it('后端字段改名 → 形状校验抛 HttpError，而不是让 undefined 溜进页面', async () => {
    respond([{ ...F.SUBJECT_LIST_OK[0], name: undefined }])
    await expect(fetchSubjects()).rejects.toThrowError(HttpError)
  })

  it('list 变成 null 也拦得住', async () => {
    respond({ ...F.FAVORITE_PAGE_OK, list: null })
    await expect(fetchFavoritePage({ subjectId: 1 })).rejects.toThrow(/list/)
  })
})
```

- [ ] **Step 2: 跑，确认红（三个模块不存在）**

Run: `npm run test:vitest -- src/api/practice/__tests__/api.spec.ts`

- [ ] **Step 3: 实现三个取数文件**

```ts
// src/api/practice/subject.ts
import { request } from '../request'
import { parseSubjectList, type SubjectItem } from './types'

export async function fetchSubjects(): Promise<SubjectItem[]> {
  return parseSubjectList(await request<unknown>('/practice/subject/list'))
}
```

```ts
// src/api/practice/question.ts
import { request } from '../request'
import { buildQuery } from './http'
import { clampPageSize } from './paging'
import {
  parseAnswerSubmit, parseQuestionCurrent, parseQuestionPage, parseSelfJudge,
  type AnswerSubmitResult, type PageVO, type QuestionCurrent, type QuestionItem, type StatDelta,
} from './types'

export interface PageQuery { subjectId: number; pageNum?: number; pageSize?: number }

/** 三个入参互斥关系的唯一出口：给了 questionId 就不给 subjectId/mode。 */
export interface CurrentQuery { subjectId?: number; mode?: 1 | 3; questionId?: number }

export interface SubmitForm {
  subjectId: number; questionId: number;
  /** 整份 JSON 的文本，只能由 answer.ts 的 encodeUserAnswer 产出 */
  userAnswerJson: string; durationMs: number; mode: 1 | 3;
}

export interface SelfJudgeForm { subjectId: number; questionId: number; recordId: number; isCorrect: boolean }

/** 分页默认值在这里定死：省略参数时后端也按 1/20 走，但 URL 稳定才好测。 */
export async function fetchQuestionPage(q: PageQuery): Promise<PageVO<QuestionItem>> {
  const query = { subjectId: q.subjectId, pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize) }
  return parseQuestionPage(await request<unknown>(`/practice/question/page${buildQuery(query)}`))
}

export async function fetchCurrent(q: CurrentQuery): Promise<QuestionCurrent> {
  const query = { subjectId: q.subjectId, mode: q.mode, questionId: q.questionId }
  return parseQuestionCurrent(await request<unknown>(`/practice/question/current${buildQuery(query)}`))
}

export async function submitAnswer(form: SubmitForm): Promise<AnswerSubmitResult> {
  return parseAnswerSubmit(await request<unknown>('/practice/answer/submit', { body: form }))
}

export async function selfJudge(form: SelfJudgeForm): Promise<StatDelta> {
  return parseSelfJudge(await request<unknown>('/practice/answer/self-judge', { body: form })).statDelta
}
```

```ts
// src/api/practice/wrongFavorite.ts
import { request } from '../request'
import { buildQuery } from './http'
import { clampPageSize } from './paging'
import {
  parseFavoritePage, parseFavoriteToggle, parseMasterFlag, parseWrongPage,
  type FavoriteItem, type PageVO, type WrongItem,
} from './types'

export interface WrongQuery { subjectId: number; status?: 1 | 2; pageNum?: number; pageSize?: number }
export interface FavoriteQuery { subjectId: number; pageNum?: number; pageSize?: number }

export async function fetchWrongPage(q: WrongQuery): Promise<PageVO<WrongItem>> {
  // status 是"省略=全部"，所以 null/undefined 必须由 buildQuery 丢掉
  const query = {
    subjectId: q.subjectId, status: q.status,
    pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize),
  }
  return parseWrongPage(await request<unknown>(`/practice/wrong/page${buildQuery(query)}`))
}

/** 只有 questionId：科目归属从错题行来（后端 WrongMasterReq） */
export async function markMastered(questionId: number): Promise<boolean> {
  return parseMasterFlag(await request<unknown>('/practice/wrong/master', { body: { questionId } }))
}

export async function fetchFavoritePage(q: FavoriteQuery): Promise<PageVO<FavoriteItem>> {
  const query = { subjectId: q.subjectId, pageNum: q.pageNum ?? 1, pageSize: clampPageSize(q.pageSize) }
  return parseFavoritePage(await request<unknown>(`/practice/favorite/page${buildQuery(query)}`))
}

export async function toggleFavorite(subjectId: number, questionId: number): Promise<boolean> {
  return parseFavoriteToggle(
    await request<unknown>('/practice/favorite/toggle', { body: { subjectId, questionId } }),
  ).favorited
}
```

- [ ] **Step 4: 跑，确认绿**

Run: `npm run test:vitest -- src/api/practice/__tests__/api.spec.ts`

如果 `/gw` 前缀那条断言红了，说明 `import.meta.env.VITE_API_BASE` 在 vitest 下有值 —— **不要改断言迁就它**，在 `vitest.config.ts` 的 `test` 里加 `env: { VITE_API_BASE: '' }`… 不行（空串会走 `|| '/gw'` 分支，正合预期），**用 `define` 或 `env` 把 `VITE_API_BASE` 固定成 `''`**，并在执行记录里写清为什么（真实 dev 走 vite proxy 的 `/gw`，测试必须和它同一条 URL）。

- [ ] **Step 5: 全量绿 + type-check 绿，提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check
git add -- src/api/practice vitest.config.ts
git commit -m "取数层三个文件 + fetch 打桩集成 spec：URL、body、信封解包与形状校验一起验" -- src/api/practice vitest.config.ts
```

---

## Task 7：`stores/practice.ts` + `useSubjects.ts`（当前科目与共享科目列表）

**Files:**
- Create: `src/stores/practice.ts`, `src/composables/useSubjects.ts`
- Test: `src/stores/__tests__/practice.spec.ts`

**Interfaces:**
- Consumes: `fetchSubjects`（Task 6）、`createSeqGuard`、`errorText`
- Produces:
  - `readStoredSubject(raw: string | null): number | null`（纯函数，可单测）
  - `usePracticeStore()` → `{ currentSubjectId: Ref<number|null>, setSubject(id: number): void }`
  - `useSubjects()` → `{ subjects, current, loading, error, reload, ensure }`；**模块级单例**（多处调用共享同一份列表与同一个 seq guard）

- [ ] **Step 1: 写失败的测试**

```ts
// src/stores/__tests__/practice.spec.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredSubject, usePracticeStore } from '../practice'

describe('readStoredSubject：localStorage 里的值不可信', () => {
  it('正常值', () => expect(readStoredSubject('2')).toBe(2))
  it('脏值一律 null', () => {
    expect(readStoredSubject(null)).toBeNull()
    expect(readStoredSubject('')).toBeNull()
    expect(readStoredSubject('abc')).toBeNull()
    expect(readStoredSubject('0')).toBeNull()      // 后端 subjectId=0 不存在，回 null 比拿 0 去打接口好
    expect(readStoredSubject('-3')).toBeNull()
    expect(readStoredSubject('1.5')).toBeNull()
    expect(readStoredSubject('NaN')).toBeNull()
  })
})

describe('usePracticeStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('setSubject 改内存态（node 环境没有 localStorage，写存储必须被 try 接住而不是崩）', () => {
    const store = usePracticeStore()
    expect(store.currentSubjectId).toBeNull()
    store.setSubject(1)
    expect(store.currentSubjectId).toBe(1)
  })

  it('两个组件读到的是同一个 store 实例', () => {
    const a = usePracticeStore()
    a.setSubject(2)
    expect(usePracticeStore().currentSubjectId).toBe(2)
  })
})
```

- [ ] **Step 2: 跑，确认红**

Run: `cd /f/AAAJAVA/code/EZ_frontend && npm run test:vitest -- src/stores/__tests__/practice.spec.ts`
Expected: 找不到模块 `../practice`。**注意**：如果它报 `Cannot read properties of undefined (reading 'getItem')`，那是 `read()` 没有把访问包在 `try` 里 —— Node 里 `localStorage` 是**未声明的标识符**，`ReferenceError` 只有在 `try` 块内发生才能被 `catch` 接住。

- [ ] **Step 3: 实现 `stores/practice.ts`**

```ts
// src/stores/practice.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

const SUBJECT_KEY = 'practice:subjectId'

/** 从存储原串还原科目 id。任何不合法形态都回 null，让调用方退回"第一个科目"。 */
export function readStoredSubject(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function read(): string | null {
  // Node（测试环境）里没有 localStorage，取它本身就是 ReferenceError —— 必须发生在 try 块内才接得住
  try {
    return localStorage.getItem(SUBJECT_KEY)
  } catch {
    return null
  }
}

function write(id: number): void {
  try {
    localStorage.setItem(SUBJECT_KEY, String(id))
  } catch {
    /* 隐私模式或配额：内存态仍然正确，本次会话不受影响（照 auth store 的处理） */
  }
}

/**
 * 只有一个字段：正在看哪一科。跨页（练习/错题本/收藏本）都要它，
 * 而题目、答题卡、分页这些一律留在页面里 —— 进 store 就是第二份真相。
 */
export const usePracticeStore = defineStore('practice', () => {
  const currentSubjectId = ref<number | null>(readStoredSubject(read()))

  function setSubject(id: number): void {
    currentSubjectId.value = id
    write(id)
  }

  return { currentSubjectId, setSubject }
})
```

- [ ] **Step 4: 跑绿**

Run: `npm run test:vitest -- src/stores/__tests__/practice.spec.ts`

- [ ] **Step 5: 实现 `useSubjects.ts`（模块级单例）**

```ts
// src/composables/useSubjects.ts
import { computed, ref } from 'vue'
import { fetchSubjects } from '../api/practice/subject'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import type { SubjectItem } from '../api/practice/types'
import { usePracticeStore } from '../stores/practice'

// 模块作用域：Layout、Subject、Drill、Wrong、Favorite 五个地方都要科目列表，
// 各自一份 ref 就会各发一次请求、各持一份数据。共享一份，只维护一次。
const subjects = ref<SubjectItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const guard = createSeqGuard()

export function useSubjects() {
  const store = usePracticeStore()
  const current = computed(() =>
    subjects.value.find(s => s.id === store.currentSubjectId) ?? null)

  async function reload(): Promise<void> {
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const list = await fetchSubjects()
      if (!guard.isCurrent(mine)) return
      subjects.value = list
      // 存的科目可能已被停用（40900）或不在这份列表里，回落到第一科而不是抱着坏 id 反复打接口
      if (!list.some(s => s.id === store.currentSubjectId) && list.length > 0) {
        store.setSubject(list[0].id)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err) ?? '科目列表加载失败'
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  /** 首次进入才拉；来回切页面不重复打接口（照 AI Layout 里会话列表的做法） */
  async function ensure(): Promise<void> {
    if (subjects.value.length === 0 && !loading.value) await reload()
  }

  return { subjects, current, loading, error, reload, ensure, store }
}
```

- [ ] **Step 6: 全量绿 + 提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check
git add -- src/stores src/composables/useSubjects.ts
git commit -m "当前科目 store + 共享科目列表 composable：脏 id 回落第一科，列表只拉一次" -- src/stores src/composables/useSubjects.ts
```

---

## Task 8：`ErrorBar` / `EmptyState` / `Layout` + 路由接线 + `Subject.vue`

到这一节结束，浏览器能打开 `/practice/subject` 看到真实科目卡 —— 这就是"可观测场景要有浏览器可打的东西"那条规则的兑现点。

**Files:**
- Create: `src/components/practice/ErrorBar.vue`, `src/components/practice/EmptyState.vue`, `src/views/Practice/Layout.vue`, `src/views/Practice/Subject.vue`
- Modify: `src/router/index.ts:26-31`（`/practice` 那条）
- Delete: `src/views/Practice/Index.vue`

**Interfaces:**
- Consumes: `useSubjects`、`usePracticeStore`、`formatDateTime`、`useTheme`
- Produces: 路由命名 `practice-subject` / `practice-drill` / `practice-wrong` / `practice-favorite`；`.practice-shell` 上声明的**本模块局部令牌**（四态色只有这一处硬编码，其它组件一律 `var()`）

- [ ] **Step 1: `ErrorBar.vue`**

```vue
<!-- src/components/practice/ErrorBar.vue -->
<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="p-error" role="alert">
    <span class="p-error__text">{{ message }}</span>
    <button class="p-error__x" type="button" aria-label="关闭提示" @click="emit('dismiss')">×</button>
  </div>
</template>

<script lang="ts">
// defineEmits 的返回值在 <script setup> 里叫 emit：显式命名一次，模板里用得到
const emit = null as never
</script>

<style scoped>
.p-error {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  background: var(--p-error-bg); color: var(--p-error-fg);
  border: 1px solid var(--divider);
}
.p-error__text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; }
.p-error__x {
  flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font-size: 16px; line-height: 1; cursor: pointer;
}
.p-error__x:hover { background: var(--divider); }
</style>
```

**上面那个多余的 `<script lang="ts">` 块是我写错了**：`<script setup>` 里 `const emit = defineEmits<...>()` 就直接可用，不需要第二块、更不需要那行占位。执行时按下面这份写：

```vue
<!-- src/components/practice/ErrorBar.vue（定稿） -->
<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="p-error" role="alert">
    <span class="p-error__text">{{ message }}</span>
    <button class="p-error__x" type="button" aria-label="关闭提示" @click="emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.p-error {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  background: var(--p-error-bg); color: var(--p-error-fg);
  border: 1px solid var(--divider);
}
.p-error__text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; }
.p-error__x {
  flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font-size: 16px; line-height: 1; cursor: pointer;
}
.p-error__x:hover { background: var(--divider); }
</style>
```

- [ ] **Step 2: `EmptyState.vue`**

```vue
<!-- src/components/practice/EmptyState.vue -->
<script setup lang="ts">
withDefaults(defineProps<{ title: string; hint?: string }>(), { hint: '' })
</script>

<template>
  <div class="p-empty">
    <p class="p-empty__title">{{ title }}</p>
    <p v-if="hint" class="p-empty__hint">{{ hint }}</p>
    <div v-if="$slots.default" class="p-empty__action"><slot /></div>
  </div>
</template>

<style scoped>
.p-empty {
  display: grid; place-items: center; gap: 6px;
  padding: 48px 20px; text-align: center;
}
.p-empty__title { margin: 0; font-size: 15px; color: var(--text-secondary); }
.p-empty__hint { margin: 0; font-size: 13px; color: var(--text-muted); }
</style>
```

空态与错误条是两个组件：**"没有数据"不是故障**，不能拿 `ErrorBar` 装空。

- [ ] **Step 3: `Layout.vue`**

```vue
<!-- src/views/Practice/Layout.vue -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { useTheme } from '../../composables/useTheme'

const NAV = [
  { name: 'practice-subject', label: '科目总览' },
  { name: 'practice-drill', label: '练习' },
  { name: 'practice-wrong', label: '错题本' },
  { name: 'practice-favorite', label: '收藏本' },
] as const

const route = useRoute()
const router = useRouter()
const theme = useTheme()
const { subjects, loading, error, reload, ensure, store } = useSubjects()

onMounted(ensure)

const activeName = computed(() => String(route.name ?? ''))

// icon 后端给的是 "icon-chinese" 这类类名 token，仓库里没有对应资源（事实清单 13）
const ICONS: Record<string, string> = { chinese: '语', math: '数' }

function subjectIcon(subjectKey: string, name: string): string {
  return ICONS[subjectKey] ?? name.slice(0, 1)
}

function pickSubject(id: number): void {
  store.setSubject(id)
  void router.push({ name: 'practice-drill' })
}

function dismissError(): void {
  error.value = null
}
</script>

<template>
  <div class="practice-shell" :class="{ dark: theme === 'dark' }">
    <aside class="sb">
      <div class="sb-brand">刷题</div>

      <nav class="sb-nav">
        <RouterLink
            v-for="item in NAV"
            :key="item.name"
            class="sb-item"
            :class="{ 'sb-item--on': activeName === item.name }"
            :to="{ name: item.name }"
        >{{ item.label }}</RouterLink>
      </nav>

      <div class="sb-subjects">
        <p class="sb-label">科目</p>
        <button
            v-for="s in subjects"
            :key="s.id"
            class="sb-subject"
            :class="{ 'sb-subject--on': store.currentSubjectId === s.id }"
            type="button"
            @click="pickSubject(s.id)"
        >
          <span class="sb-icon">{{ subjectIcon(s.subjectKey, s.name) }}</span>
          <span class="sb-name">{{ s.name }}</span>
          <span class="sb-count">{{ s.questionCount }}</span>
        </button>
        <button v-if="!loading" class="sb-item" type="button" @click="reload">重新加载科目</button>
      </div>
    </aside>

    <main class="main">
      <ErrorBar v-if="error" :message="error" @dismiss="error = null" />
      <div class="page-area"><RouterView /></div>
    </main>
  </div>
</template>

<style scoped>
.practice-shell {
  /* 全局令牌里没有语义色（事实清单 14）：四态色只能本模块自己定义，
     硬编码值只允许出现在这一处，其它组件一律 var() 取。 */
  --p-idle: var(--bg-elevated);
  --p-correct: #16a34a;
  --p-wrong: #dc2626;
  --p-pending: #d97706;
  --p-error-bg: rgba(220, 38, 38, 0.08);
  --p-error-fg: #b91c1c;

  position: fixed;
  inset: 0;
  display: flex;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 14px;
}
.practice-shell.dark {
  --p-correct: #4ade80;
  --p-wrong: #f87171;
  --p-pending: #fbbf24;
  --p-error-bg: rgba(248, 113, 113, 0.12);
  --p-error-fg: #fca5a5;
}

.sb {
  width: 220px; flex: none; padding: 14px 10px;
  border-right: 1px solid var(--divider);
  display: flex; flex-direction: column; gap: 16px; overflow: auto;
}
.sb-brand { font-size: 16px; font-weight: 600; padding: 0 8px; }
.sb-nav { display: flex; flex-direction: column; gap: 2px; }
.sb-item {
  display: block; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--text-secondary);
  font: inherit; text-align: left; text-decoration: none; cursor: pointer;
}
.sb-item:hover { background: var(--glass-bg-hover); color: var(--text-primary); }
.sb-item--on { background: var(--glass-bg); color: var(--text-primary); font-weight: 600; }
.sb-label { margin: 0 0 6px; padding: 0 10px; font-size: 12px; color: var(--text-muted); }
.sb-subjects { display: flex; flex-direction: column; gap: 2px; }
.sb-subject {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--text-secondary); font: inherit;
  text-align: left; cursor: pointer;
}
.sb-subject:hover { background: var(--glass-bg-hover); }
.sb-subject--on { background: var(--glass-bg); color: var(--text-primary); }
.sb-icon { flex: none; width: 20px; height: 20px; display: grid; place-items: center;
  border-radius: 6px; background: var(--glass-bg); font-size: 11px; }
.sb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-count { flex: none; font-size: 12px; color: var(--text-muted); }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 14px; gap: 12px; }
.page-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }

@media (max-width: 767px) {
  .practice-shell { flex-direction: column; }
  .sb { width: 100%; flex-direction: row; flex-wrap: wrap; gap: 8px;
    border-right: 0; border-bottom: 1px solid var(--divider); }
  .sb-subjects, .sb-brand { display: none; }
}
</style>
```

`@click="reload"` 直接绑 composable 返回的函数、`v-if="!loading"` 的加载中文案 —— 都在这一处，别在子页面重复实现。`error = null` 能对 ref 赋值是因为 `<script setup>` 返回的是 ref，模板自动解包；**脚本里**要写 `error.value = null`。

- [ ] **Step 4: `Subject.vue`**

```vue
<!-- src/views/Practice/Subject.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import EmptyState from '../../components/practice/EmptyState.vue'
import { useRouter } from 'vue-router'
import { useSubjects } from '../../composables/useSubjects'
import { formatDateTime } from '../../utils/datetime'

const { subjects, loading, error, reload, ensure, store } = useSubjects()
const router = useRouter()

onMounted(ensure)

function percent(accuracy: number): string {
  // myAccuracy 是 0~1 的比值（事实清单 4），不是百分数
  return `${Math.round(accuracy * 10000) / 100}%`
}

function open(s: { id: number }): void {
  store.setSubject(s.id)
  void router.push({ name: 'practice-drill' })
}
</script>

<template>
  <section class="subject">
    <header class="head">
      <h1 class="title">科目总览</h1>
      <button class="ghost" type="button" :disabled="loading" @click="reload">
        {{ loading ? '加载中…' : '刷新' }}
      </button>
    </header>

    <p v-if="error" class="warn">{{ error }}</p>

    <EmptyState v-else-if="!loading && subjects.length === 0"
                title="还没有可练习的科目" hint="题库里没有启用中的科目，或科目都被停用了。" />

    <div v-else class="grid">
      <button
          v-for="s in subjects"
          :key="s.id"
          class="card glass-lite"
          type="button"
          @click="open(s)"
      >
        <p class="card-title">{{ s.name }}</p>
        <p v-if="s.description" class="card-desc">{{ s.description }}</p>
        <dl class="stats">
          <div><dt>题目</dt><dd>{{ s.questionCount }}</dd></div>
          <div><dt>已答</dt><dd>{{ s.myTotal }}</dd></div>
          <div><dt>答对</dt><dd>{{ s.myCorrect }}</dd></div>
          <div><dt>正确率</dt><dd>{{ percent(s.myAccuracy) }}</dd></div>
        </dl>
        <p class="last">上次作答：{{ formatDateTime(s.lastAnswerAt) }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.subject { display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.title { margin: 0; font-size: 18px; }
.ghost {
  padding: 6px 12px; border: 1px solid var(--divider); border-radius: 8px;
  background: transparent; color: var(--text-secondary); font: inherit; cursor: pointer;
}
.ghost:disabled { opacity: .6; cursor: default; }
.warn { margin: 0; color: var(--p-error-fg, var(--text-secondary)); font-size: 13px; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.card { padding: 16px; border: 1px solid var(--divider); border-radius: 12px;
  text-align: left; font: inherit; color: inherit; cursor: pointer; }
.card:hover { border-color: var(--glass-border-strong); }
.card-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.card-desc { margin: 0 0 10px; font-size: 12px; color: var(--text-muted); }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; margin: 0; }
.stats div { display: flex; justify-content: space-between; }
.stats dt { color: var(--text-muted); font-size: 12px; }
.stats dd { margin: 0; font-size: 13px; }
.last { margin: 10px 0 0; font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 5: 路由接线（`src/router/index.ts:26-31`）**

把现有的 `/practice` 那条整体替换为：

```ts
    {
      path: '/practice',
      component: () => import('../views/Practice/Layout.vue'),
      meta: { title: '刷题模块', requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'practice-subject' } },
        { path: 'subject', name: 'practice-subject', component: () => import('../views/Practice/Subject.vue') },
        // 下面三条分别在 Task 10 Step 4 / Task 13 Step 3 / Task 14 Step 3 补进来 ——
        // 现在写会让 npm run type-check 因文件不存在而红（Vite 的懒加载不碰它，vue-tsc 会）
        { path: 'drill', name: 'practice-drill', component: () => import('../views/Practice/Drill.vue') },
        { path: 'wrong', name: 'practice-wrong', component: () => import('../views/Practice/Wrong.vue') },
        { path: 'favorite', name: 'practice-favorite', component: () => import('../views/Practice/Favorite.vue') },
      ],
    },
```

Drill/Wrong/Favorite 三个文件这一步还不存在 —— 所以这一步**只做到** `npm run dev` 能开 `/practice/subject`，另外三个的懒加载 import 在 Task 10/13/14 才补上。**执行方式**：这一步先只写 `subject` 一条子路由（`children` 里只留 `''` redirect 与 `practice-subject`），Task 10 Step 1、Task 13 Step 1、Task 14 Step 1 各补自己那条。**原因**：Vite 的按需编译不会碰没被访问的 import，但 `vue-tsc` 会 —— 提前写了不存在的文件，`npm run type-check` 必红，那就不是绿灯而是假灯。

删掉占位页：

```bash
cd /f/AAAJAVA/code/EZ_frontend && git rm -- src/views/Practice/Index.vue
```

- [ ] **Step 6: 绿灯 + 浏览器实跑这两条**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check
```

浏览器（先看事实清单 21 的三个端口是否在听）：`npm run dev` → 打开 `http://localhost:5173/practice`

1. 未登录 → 跳 `/login?redirect=/practice/subject`（守卫 + `resolveRedirect` 都在，不该有任何新代码）
2. 登录后 → 科目卡数字与 `GET /gw/practice/subject/list` 的响应**逐个相等**（`questionCount` 4/3、`myTotal` 10/2、正确率 70%/100%）

判据不过就回到 `useSubjects`/`parseSubjectList` 找原因，**不要改判据**。把实测数字写进本计划的执行记录。

- [ ] **Step 7: 提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend
git add -- src/components/practice src/views/Practice src/router/index.ts src/utils src/stores
git commit -m "练习模块外壳：科目侧栏 + 错误条 + 空态 + 总览页，/practice 起要求登录" -- src/components/practice src/views/Practice src/router/index.ts src/utils src/stores
```

`git status --short` 复核：`ShinyText.vue` 仍是 `AM`、`Home.vue` 仍是 `M`。

---

## Task 9：`QuestionBody.vue` —— 五题型的作答控件

**Files:**
- Create: `src/components/practice/QuestionBody.vue`

**Interfaces:**
- Consumes: `Question`（Task 3）、`blankSlots` / `TYPE_*`（Task 4）、`JellyRadio`（既有组件，只 emit `change`）
- Produces: `props: { question: Question; modelValue: AnswerValue }`，`emit('update:modelValue', value)` —— **约定：`type=4` 时 `modelValue` 是 `string[]`，与 `blankSlots` 给出的空数组等长**

- [ ] **Step 1: 写组件**

```vue
<!-- src/components/practice/QuestionBody.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import JellyRadio from '../JellyRadio.vue'
import {
  TYPE_BLANK, TYPE_ESSAY, TYPE_JUDGE, TYPE_MULTI, TYPE_SINGLE, blankSlots,
} from '../../api/practice/answer'
import type { Question } from '../../api/practice/types'
import type { AnswerValue } from '../../api/practice/answer'

const props = defineProps<{ question: Question; modelValue: AnswerValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: AnswerValue] }>()

const radioItems = computed(() =>
  props.question.options.map(o => ({ value: o.optionKey, label: `${o.optionKey}. ${o.content}` })))

const single = computed({
  get: () => (typeof props.modelValue === 'string' ? props.modelValue : ''),
  set: (v: string) => emit('update:modelValue', v),
})

const multi = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

/**
 * 填空的两条分支只由 blankSlots 决定：数得出槽数 → N 个输入框（modelValue 是 string[]）；
 * 数不出来 → 一个 textarea（modelValue 是"按行切出来的 string[]"）。
 * blankList 为空就是"该走 textarea"的信号，所以它只从 blankSlots 取，不看 modelValue 的长度
 * —— 早期草稿里让它回退成 `?? ['']`，结果是 textarea 分支永不可达，而且 textarea 绑的是
 * 一个字符串 computed，输入的内容立刻被回写成空串（打字消失）。
 */
const slotCount = computed<string[] | null>(() => blankSlots(props.question.title))

const blankList = computed<string[]>(() => {
  if (slotCount.value === null) return []
  return Array.isArray(props.modelValue) ? props.modelValue : slotCount.value
})

const freeformText = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue.join('\n') : '')

function setFreeform(value: string): void {
  emit('update:modelValue', value.split('\n'))
}

function toggleOption(key: string): void {
  const next = multi.value.includes(key)
    ? multi.value.filter(k => k !== key)
    : [...multi.value, key]
  emit('update:modelValue', next)
}

function setBlank(index: number, value: string): void {
  const next = [...blanks.value]
  next[index] = value
  emit('update:modelValue', next)
}

function setJudge(value: boolean): void {
  emit('update:modelValue', value)
}

const essay = computed({
  get: () => (typeof props.modelValue === 'string' ? props.modelValue : ''),
  set: (v: string) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="qbody">
    <p class="qhead">
      <span class="qtype">{{ question.typeName }}</span>
      <span v-if="question.index !== null" class="qindex">第 {{ question.index }} 题</span>
      <span v-if="question.difficulty !== null" class="qdiff">难度 {{ question.difficulty }}</span>
      <span v-for="t in question.tags" :key="t" class="qtag">{{ t }}</span>
    </p>

    <p class="qtitle">{{ question.title }}</p>

    <!-- 1 单选：JellyRadio 只 emit change，没有 v-model（事实清单 16） -->
    <JellyRadio
        v-if="question.type === TYPE_SINGLE"
        :items="radioItems"
        :value="single"
        aria-label="选择一个选项"
        @change="(v: string) => (single = v)"
    />

    <!-- 2 多选 -->
    <ul v-else-if="question.type === TYPE_MULTI" class="opts">
      <li v-for="o in question.options" :key="o.optionKey">
        <label class="opt">
          <input
              type="checkbox"
              :checked="multi.includes(o.optionKey)"
              @change="toggleOption(o.optionKey)"
          />
          <span>{{ o.optionKey }}. {{ o.content }}</span>
        </label>
      </li>
    </ul>

    <!-- 3 判断 -->
    <div v-else-if="question.type === TYPE_JUDGE" class="judge">
      <button
          v-for="opt in [{ v: true, label: '对' }, { v: false, label: '错' }]"
          :key="opt.label"
          class="chip"
          :class="{ 'chip--on': modelValue === opt.v }"
          type="button"
          @click="setJudge(opt.v)"
      >{{ opt.label }}</button>
    </div>

    <!-- 4 填空：counted 给 N 个框；freeform 给一个（数组由换行切出来） -->
    <div v-else-if="question.type === TYPE_BLANK" class="blanks">
      <template v-if="blankList.length > 0">
        <label v-for="(slot, i) in blankList" :key="i" class="blank">
          <span class="blank-no">第 {{ i + 1 }} 空</span>
          <input :value="slot" type="text" @input="setBlank(i, ($event.target as HTMLInputElement).value)" />
        </label>
      </template>
      <textarea
          v-else
          class="essay"
          rows="4"
          placeholder="多个空按行分隔"
          :value="freeformText"
          @input="setFreeform(($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- 5 简答 -->
    <textarea
        v-else-if="question.type === TYPE_ESSAY"
        v-model="essay"
        class="essay"
        rows="5"
        placeholder="作答后点击提交，之后自行判断是否答对"
    />

    <!-- 未知题型：明确报错，不渲染空表单 -->
    <p v-else class="unknown">这道题的题型（{{ question.type }}）还不支持作答。</p>
  </div>
</template>

<style scoped>
.qbody { display: flex; flex-direction: column; gap: 12px; }
.qhead { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; font-size: 12px; color: var(--text-muted); }
.qtype { padding: 2px 8px; border-radius: 999px; background: var(--glass-bg); color: var(--text-secondary); }
.qtitle { margin: 0; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
.opts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.opt { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.opt input { width: 16px; height: 16px; accent-color: var(--primary-500); }
.judge { display: flex; gap: 10px; }
.chip {
  min-width: 72px; padding: 8px 14px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-primary); font: inherit; cursor: pointer;
}
.chip--on { border-color: var(--primary-500); font-weight: 600; }
.blanks { display: flex; flex-direction: column; gap: 10px; }
.blank { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }
.blank input {
  flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--divider);
  border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); font: inherit;
}
.essay {
  width: 100%; padding: 10px; border: 1px solid var(--divider); border-radius: 10px;
  background: var(--bg-elevated); color: var(--text-primary); font: inherit;
  resize: vertical; box-sizing: border-box;
}
.unknown { color: var(--p-wrong); font-size: 13px; }
</style>
```

- [ ] **Step 2: 两条门都绿**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm run type-check && npm run build-only
```

`vite build` 会编译 SFC 模板 —— **这是本任务唯一的自动检查**（不写组件测试是裁定二）。模板里的类型断言（`$event.target as HTMLInputElement`）在 vue-tsc 下必须过；过不了就是模板写错，不许加 `// @ts-expect-error` 蒙过去。

- [ ] **Step 3: 提交**

```bash
git add -- src/components/practice/QuestionBody.vue
git commit -m "五种题型的作答控件：JellyRadio 用 change、填空按 blankSlots 决定槽数" -- src/components/practice/QuestionBody.vue
```

---

## Task 10：`useDrill.ts` + `Drill.vue` —— 顺序 / 智能练习 / 提交 / 解析

**Files:**
- Create: `src/composables/useDrill.ts`, `src/views/Practice/Drill.vue`
- Modify: `src/api/practice/answer.ts`（新增 `initialModel`）、`src/api/practice/__tests__/answer.spec.ts`
- Modify: `src/router/index.ts`（补 `practice-drill` 子路由）

**Interfaces:**
- Consumes: `fetchCurrent` / `fetchQuestionPage` / `submitAnswer`、`normalizePage`、`cardState` 系列、`useSubjects`、`usePracticeStore`
- Produces:
  - `initialModel(type: number, title: string): AnswerValue`（`answer.ts` 新增）
  - `useDrill(getSubjectId: () => number | null)` → `{ target, mode, cardCells, question, answerStatus, model, result, revealed, finished, loading, busy, error, stat, favorited, canJudge, showAnswer, currentId, pendingRecordId, loadCard, open, submit, toggleFav }`
  - `type DrillTarget = { kind: 'mode'; mode: 1 | 3 } | { kind: 'question'; questionId: number }`、`interface DrillCardCell { index: number; questionId: number; state: CardState }`

- [ ] **Step 1: 给 `answer.ts` 补 `initialModel` —— 先写失败测试**

追加到 `src/api/practice/__tests__/answer.spec.ts`（`blankSlots`、`initialModel` 加进已有的 import 列表）：

```ts
describe('initialModel：进入一题时的作答初值', () => {
  it('填空：给与 blankSlots 同一个形态，两处数的槽数必须一致', () => {
    const title = '根据内容填空：___ 与 ___ 。'
    expect(initialModel(TYPE_BLANK, title)).toEqual(blankSlots(title) ?? [''])
  })
  it('填空（无占位符）：回一个空串的数组，QuestionBody 走单框分支', () => {
    expect(initialModel(TYPE_BLANK, '没有任何占位符的题干')).toEqual([''])
  })
  it('多选回空数组而不是 null：checkbox 的 includes 判断需要数组', () => {
    expect(initialModel(TYPE_MULTI, '题干')).toEqual([])
  })
  it('其余题型都是 null（未选择）', () => {
    expect(initialModel(TYPE_SINGLE, '题干')).toBeNull()
    expect(initialModel(TYPE_JUDGE, '题干')).toBeNull()
    expect(initialModel(TYPE_ESSAY, '题干')).toBeNull()
  })
})
```

第一条用 `blankSlots(title) ?? ['']` 而不是写死 `['', '']`：`BLANK_MODE` 还没定案（Task 2），**写死会让这条测试在另一种定案下必红**，而那不是代码错。它钉的是"initialModel 与 blankSlots 不许各数一遍"这件事。

Run: `npm run test:vitest -- src/api/practice/__tests__/answer.spec.ts` → **红**（`initialModel` 不存在）。

实现追加到 `answer.ts` 末尾：

```ts
/**
 * 进入一题时的默认作答值。
 * 填空给的是"槽数"，QuestionBody 与 submit 都从这一个来源取槽数，
 * 两处各数一遍迟早数出不同的结果（后端逐位比对，长度错了就是答案错了）。
 */
export function initialModel(type: number, title: string): AnswerValue {
  if (type === TYPE_MULTI) return []
  if (type === TYPE_BLANK) return blankSlots(title) ?? ['']
  return null
}
```

- [ ] **Step 2: 写 `useDrill.ts`**

```ts
// src/composables/useDrill.ts
import { computed, ref } from 'vue'
import {
  fetchCurrent, fetchQuestionPage, submitAnswer as submitApi,
  type CurrentQuery, type SubmitForm,
} from '../api/practice/question'
import { toggleFavorite } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage } from '../api/practice/paging'
import {
  canSelfJudge, cardState, cardStateAfterSubmit, clampDuration, decodeUserAnswer,
  encodeUserAnswer, initialModel,
  type AnswerValue, type CardState,
} from '../api/practice/answer'
import {
  ANSWER_PENDING, type AnswerSubmitResult, type Question, type QuestionCurrent, type StatDelta,
} from '../api/practice/types'

export type DrillTarget = { kind: 'mode'; mode: 1 | 3 } | { kind: 'question'; questionId: number }

export interface DrillCardCell {
  index: number
  questionId: number
  state: CardState
}

/**
 * 三个独立的 seq guard，不是一个。
 * 页面进入时 loadCard 与 open 是**并发**的两条请求 —— 共用一个 guard 的话，
 * 后发的那条会把先发的判成过期，答题卡永远空。这是"切科目不串数据"和
 * "答题卡与当前题各自独立"两个要求唯一能同时成立的形式。
 */
export function useDrill(getSubjectId: () => number | null) {
  const target = ref<DrillTarget>({ kind: 'mode', mode: 1 })
  const mode = computed<1 | 3>(() => (target.value.kind === 'mode' ? target.value.mode : 1))

  interface RawCell { index: number; questionId: number; answerStatus: number; favorited: boolean }

  const rawCells = ref<RawCell[]>([])
  const question = ref<Question | null>(null)
  const answerStatus = ref<number | null>(null)
  const pendingRecordId = ref<number | null>(null)
  const model = ref<AnswerValue>(null)
  const result = ref<AnswerSubmitResult | null>(null)
  const revealed = ref(false)          // 裁定七：待自评时参考答案先藏着，判完才展开
  const finished = ref(false)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  const stat = ref<StatDelta | null>(null)
  const favorited = ref(false)

  const cardGuard = createSeqGuard()
  const flowGuard = createSeqGuard()
  const favGuard = createSeqGuard()
  let startAt = Date.now()

  const cardCells = computed<DrillCardCell[]>(() =>
    rawCells.value.map(c => ({ index: c.index, questionId: c.questionId, state: cardState(c.answerStatus) })))

  const currentId = computed(() => question.value?.questionId ?? null)

  const canJudge = computed(() =>
    result.value !== null
      ? result.value.needSelfJudge
      : canSelfJudge(answerStatus.value, pendingRecordId.value))

  const showAnswer = computed(() => {
    if (!result.value) return false
    return !result.value.needSelfJudge || revealed.value
  })

  /** question/current 是唯一给题的地方，所以"进入一题"的状态复位也只此一处 */
  function applyCurrent(cur: QuestionCurrent): void {
    finished.value = cur.finished
    pendingRecordId.value = cur.pendingRecordId
    const current = cur.question
    question.value = current
    answerStatus.value = cur.answerStatus
    // 上次作答优先；坏数据（decode 回 null）退回该题型的默认初值
    model.value = current
      ? decodeUserAnswer(current.type, cur.lastUserAnswerJson) ?? initialModel(current.type, current.title)
      : null
    result.value = null
    revealed.value = false
    favorited.value = current
      ? rawCells.value.some(c => c.questionId === current.questionId && c.favorited)
      : false
    startAt = Date.now()
  }

  async function loadCard(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = cardGuard.next()
    try {
      const vo = await fetchQuestionPage({ subjectId, pageNum: 1, pageSize: clampPageSize(100) })
      if (!cardGuard.isCurrent(mine)) return
      const page = normalizePage(vo)
      rawCells.value = page.list.map(item => ({
        index: item.index, questionId: item.questionId,
        answerStatus: item.answerStatus, favorited: item.favorited,
      }))
    } catch (err) {
      if (cardGuard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  async function open(next: DrillTarget): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    target.value = next
    const mine = flowGuard.next()
    loading.value = true
    error.value = null
    try {
      // 参数形态由 target 的判别式决定：重做流只给 questionId，两个都给会被后端 40000 拒
      const query: CurrentQuery = next.kind === 'question'
        ? { questionId: next.questionId }
        : { subjectId, mode: next.mode }
      const cur = await fetchCurrent(query)
      if (!flowGuard.isCurrent(mine)) return
      applyCurrent(cur)
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) loading.value = false
    }
  }

  async function submit(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null || !question.value) return
    const questionId = question.value.questionId
    let userAnswerJson: string
    try {
      userAnswerJson = encodeUserAnswer(question.value.type, model.value)
    } catch (err) {
      error.value = errorText(err) ?? '请先作答'      // 空作答在前端就拦住，不打后端
      return
    }
    const form: SubmitForm = {
      subjectId, questionId, userAnswerJson,
      durationMs: clampDuration(Date.now() - startAt), mode: mode.value,
    }
    // 提交也算流程里的一步：期间用户切了题，这份结果就不该落到新题上
    const mine = flowGuard.next()
    busy.value = true
    error.value = null
    try {
      const got = await submitApi(form)
      if (!flowGuard.isCurrent(mine)) return
      result.value = got
      revealed.value = !got.needSelfJudge             // 自动判分的题直接展开解析
      stat.value = got.statDelta                      // 累计快照，覆盖而不是相加
      patchCell(questionId, cardStateAfterSubmit(got))
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) busy.value = false
    }
  }

  function patchCell(questionId: number, state: CardState): void {
    const back: Record<CardState, number> = { idle: 0, correct: 1, wrong: 2, pending: ANSWER_PENDING }
    rawCells.value = rawCells.value.map(c =>
      c.questionId === questionId ? { ...c, answerStatus: back[state] } : c)
  }

  async function toggleFav(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null || !question.value) return
    const questionId = question.value.questionId
    const mine = favGuard.next()
    try {
      // 以后端返回的 favorited 为准，不做乐观翻转
      const now = await toggleFavorite(subjectId, questionId)
      if (!favGuard.isCurrent(mine)) return
      favorited.value = now
      rawCells.value = rawCells.value.map(c =>
        c.questionId === questionId ? { ...c, favorited: now } : c)
    } catch (err) {
      if (favGuard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  return {
    target, mode, cardCells, question, answerStatus, model, result, revealed, finished,
    loading, busy, error, stat, favorited, canJudge, showAnswer, currentId, pendingRecordId,
    loadCard, open, submit, toggleFav,
  }
}
```

**科目统计的初值**不在 `useDrill` 里取：`stat` 只在提交/自评之后有值（那时它是 `statDelta` 快照）。提交前页面显示的是 `useSubjects().current` 那份（`myTotal`/`myCorrect`/`myAccuracy`），`Drill.vue` 用 `currentSubject` 渲染，两条来源不同但都是后端的绝对值 —— **不许把它们相加或互相初始化**，那是两份真相。

`open(target: DrillTarget)` 的参数名原本是 `target`，会把同名的 ref 遮住（`target.value = target` 在 `target` 是参数时其实成立，但可读性极差且容易改成自赋值），所以定稿里参数叫 `next`。

- [ ] **Step 3: `Drill.vue`**

```vue
<!-- src/views/Practice/Drill.vue -->
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AnswerCard from '../../components/practice/AnswerCard.vue'   // Task 12 建，这一步先注释掉这一行与模板里的 <AnswerCard>
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import QuestionBody from '../../components/practice/QuestionBody.vue'
import { useDrill } from '../../composables/useDrill'
import { useSubjects } from '../../composables/useSubjects'

const route = useRoute()
const { current: currentSubject, ensure } = useSubjects()
const drill = useDrill(() => currentSubject.value?.id ?? null)

function queryQuestionId(): number | null {
  const raw = route.query.questionId
  const id = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function boot(): Promise<void> {
  await ensure()
  if (!currentSubject.value) return
  void drill.loadCard()
  const qid = queryQuestionId()
  void drill.open(qid !== null ? { kind: 'question', questionId: qid } : { kind: 'mode', mode: drill.mode.value })
}

onMounted(boot)

// 点侧栏科目时人已经停在 /practice/drill：路由没变、组件不重挂，
// 所以换科目必须看 currentSubjectId，否则答题卡与题目都停在上一科（Task 15 的竞态判据走的就是这条）
watch(() => currentSubject.value?.id, () => {
  void drill.loadCard()
  void drill.open({ kind: 'mode', mode: drill.mode.value })
})

// 点错题本/答题卡进来都是同一个页面，只是 query 变了 —— 必须跟着重新取题
watch(() => route.query.questionId, () => {
  const qid = queryQuestionId()
  void drill.open(qid !== null ? { kind: 'question', questionId: qid } : { kind: 'mode', mode: drill.mode.value })
})

function percent(accuracy: number): string {
  return `${Math.round(accuracy * 10000) / 100}%`
}
</script>

<template>
  <section class="drill">
    <header class="head">
      <h1 class="title">{{ currentSubject?.name ?? '未选题' }}</h1>
      <p v-if="currentSubject" class="stat">
        共 {{ currentSubject.questionCount }} 题 · 已答 {{ currentSubject.myTotal }} ·
        正确率 {{ percent(currentSubject.myAccuracy) }}
      </p>
      <div class="modes">
        <button class="chip" :class="{ 'chip--on': drill.mode.value === 1 }"
                type="button" @click="drill.open({ kind: 'mode', mode: 1 })">顺序练习</button>
        <button class="chip" :class="{ 'chip--on': drill.mode.value === 3 }"
                type="button" @click="drill.open({ kind: 'mode', mode: 3 })">智能练习</button>
      </div>
      <button class="ghost" type="button" @click="drill.toggleFav()">
        {{ drill.favorited.value ? '取消收藏' : '收藏本题' }}
      </button>
    </header>

    <ErrorBar v-if="drill.error.value" :message="drill.error.value" @dismiss="drill.error.value = null" />

    <EmptyState v-if="drill.finished.value" title="这一科已经全部作答"
                hint="换个模式，或者去错题本看看没掌握的题目。">
      <button class="ghost" type="button" @click="drill.open({ kind: 'mode', mode: 3 })">智能练习</button>
    </EmptyState>

    <template v-else-if="drill.question.value">
      <QuestionBody
          :question="drill.question.value"
          :model-value="drill.model.value"
          @update:model-value="drill.model.value = $event"
      />

      <div class="actions">
        <button class="primary" type="button" :disabled="drill.busy.value" @click="drill.submit()">
          {{ drill.busy.value ? '提交中…' : '提交答案' }}
        </button>
      </div>

      <!-- 解析面板：showAnswer 为 false 时参考答案先藏着（裁定七） -->
      <div v-if="drill.result.value" class="panel glass-lite">
        <p class="verdict">
          <template v-if="drill.result.value.needSelfJudge && !drill.revealed.value">
            这道题不自动判分，请自评。
          </template>
          <template v-else-if="drill.result.value.isCorrect">答对了</template>
          <template v-else>答错了</template>
        </p>

        <template v-if="drill.showAnswer.value">
          <p class="row"><b>正确答案</b><code>{{ drill.result.value.correctAnswerJson }}</code></p>
          <p v-if="drill.result.value.analysis" class="row"><b>解析</b>{{ drill.result.value.analysis }}</p>
          <p class="row">
            <b>科目统计</b>共 {{ drill.stat.value?.total ?? 0 }} 题 ·
            对 {{ drill.stat.value?.correct ?? 0 }} · 错 {{ drill.stat.value?.wrong ?? 0 }} ·
            正确率 {{ Math.round((drill.stat.value?.accuracy ?? 0) * 10000) / 100 }}%
          </p>
          <p class="row">
            <b>本题</b>累计答错 {{ drill.result.value.wrongCount }} 次
            <span v-if="drill.result.value.wrongMastered"> · 已掌握</span>
            <span v-else> · 未掌握</span>
          </p>
        </template>

        <div v-if="drill.canJudge.value" class="judge-actions">
          <button type="button" class="primary" @click="/* Task 11 */">我答对了</button>
          <button type="button" class="ghost" @click="/* Task 11 */">我答错了</button>
        </div>

        <button v-else type="button" class="ghost" @click="drill.open({ kind: 'mode', mode: drill.mode.value })">
          下一题
        </button>
      </div>
    </template>

    <p v-else-if="!drill.loading.value && !drill.error.value" class="hint">
      这道题暂时打不开，换个模式或去列表里点一道。
    </p>

    <!-- <AnswerCard :cells="drill.cardCells.value" :current-id="drill.currentId.value" @select="(id: number) => drill.open({ kind: 'question', questionId: id })" /> -->
  </section>
</template>

<style scoped>
.drill { display: flex; flex-direction: column; gap: 16px; max-width: 760px; margin: 0 auto; width: 100%; }
.head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title { margin: 0; font-size: 17px; flex: 1; min-width: 0; }
.modes { display: flex; gap: 6px; }
.chip {
  padding: 6px 12px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-secondary); font: inherit; cursor: pointer;
}
.chip--on { border-color: var(--primary-500); color: var(--text-primary); font-weight: 600; }
.ghost, .primary {
  padding: 8px 16px; border-radius: 9px; font: inherit; cursor: pointer;
  border: 1px solid var(--divider); background: transparent; color: var(--text-secondary);
}
.primary { background: var(--primary-500); border-color: var(--primary-500); color: var(--primary-contrast); }
.ghost:disabled, .primary:disabled { opacity: .6; cursor: default; }
.actions { display: flex; gap: 10px; }
.panel { padding: 14px; border: 1px solid var(--divider); border-radius: 12px; display: grid; gap: 8px; }
.verdict { margin: 0; font-size: 15px; font-weight: 600; }
.row { margin: 0; font-size: 13px; color: var(--text-secondary); }
.row b { margin-right: 8px; color: var(--text-muted); font-weight: 500; }
.row code { padding: 2px 6px; border-radius: 6px; background: var(--glass-bg); }
.judge-actions { display: flex; gap: 10px; }
.hint { color: var(--text-muted); font-size: 13px; }
</style>
```

Task 10 的**交付边界**：自评按钮的两个 `@click` 是留给 Task 11 的接缝（模板里明确标了注释），`AnswerCard` 的 import 与用法先注释掉。**这两处在 Task 11/12 必须回来补成真的**，中间态不许提交成"看起来完成"。

- [ ] **Step 4: 补 `practice-drill` 子路由，跑绿灯**

`src/router/index.ts` 的 children 里加：

```ts
        { path: 'drill', name: 'practice-drill', component: () => import('../views/Practice/Drill.vue') },
```

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check && npm run build-only
```

- [ ] **Step 5: 浏览器实跑（前提：8100/8102/8103 在听，且监听 PID 是自己起的实例）**

`npm run dev` → `/practice/drill`，逐条看：

1. 默认"顺序练习"给出的是**第一道未答题**；答一题对一题，答题卡区（Task 12 才有）先看不看无所谓
2. 提交答错的题 → 解析面板出现正确答案与解析，用时/错题计数照 `submit` 响应显示
3. "智能练习"在无未掌握错题的科目上 = 顺序（后端 `QuestionReadServiceImpl:122-126`），**页面不许显示"没题了"**
4. 全部做完 → `finished` 空态而不是空白
5. devtools Network 里 `userAnswerJson` 的值必须是 `'"A"'` / `'["A","B"]'` / `'true'` 这类**单值 JSON 文本**

把每条的实测数字写进执行记录。

- [ ] **Step 6: 提交**

```bash
git add -- src/composables/useDrill.ts src/views/Practice/Drill.vue src/api/practice/answer.ts src/api/practice/__tests__/answer.spec.ts src/router/index.ts
git commit -m "练习页接通：三种取题模式、提交、解析面板与科目统计（快照覆盖）" -- src/composables src/views/Practice/Drill.vue src/api/practice src/router/index.ts
```

---

## Task 11：自评流 —— `needSelfJudge` 时先藏参考答案

**Files:**
- Modify: `src/composables/useDrill.ts`（加 `judge()`）、`src/views/Practice/Drill.vue`（两个按钮接上）

**Interfaces:**
- Consumes: `selfJudge`（`api/practice/question.ts`）、`canSelfJudge`
- Produces: `useDrill().judge(isCorrect: boolean): Promise<void>`、`drill.judging: Ref<boolean>`

- [ ] **Step 1: `useDrill` 里加 `judge`**

在 `submit()` 之后插入（`useDrill` 顶部补 `selfJudge as selfJudgeApi` 的 import，以及 `ANSWER_CORRECT`/`ANSWER_WRONG` 两个常量）：

```ts
  const judging = ref(false)
  const judgedTip = ref<string | null>(null)

  /**
   * 自评的 recordId 有两个来源：本轮 submit 的返回，或刷新后 current 的 pendingRecordId。
   *
   * 一条实测边界：参考答案与解析**只在 answer/submit 的响应里给**（question/current 是答题态，
   * 不含真值）。所以刷新页面后再来自评，判完只能更新态与统计，没有答案可展开 ——
   * showAnswer 依赖 result，那种情况下天然就是 false，页面靠 judgedTip 给反馈。
   */
  async function judge(isCorrect: boolean): Promise<void> {
    const subjectId = getSubjectId()
    const recordId = result.value?.recordId ?? pendingRecordId.value
    if (subjectId === null || !question.value || recordId === null) return
    const questionId = question.value.questionId
    const mine = flowGuard.next()
    judging.value = true
    error.value = null
    try {
      const got = await selfJudgeApi({ subjectId, questionId, recordId, isCorrect })
      if (!flowGuard.isCurrent(mine)) return
      stat.value = got                         // 同样是累计快照，覆盖
      pendingRecordId.value = null
      answerStatus.value = isCorrect ? ANSWER_CORRECT : ANSWER_WRONG
      patchCell(questionId, isCorrect ? 'correct' : 'wrong')
      judgedTip.value = isCorrect ? '已记录自评：答对' : '已记录自评：答错'
      if (result.value) {
        // 本轮提交过才有答案与解析可展开；措辞也从"请自评"收敛成结果
        result.value = { ...result.value, isCorrect, needSelfJudge: false }
        revealed.value = true
      }
    } catch (err) {
      if (flowGuard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (flowGuard.isCurrent(mine)) judging.value = false
    }
  }
```

`applyCurrent` 里补一行 `judgedTip.value = null`（换题就要清），返回对象里加 `judge, judging, judgedTip, canJudge`。

**`result.value = { ...result.value, isCorrect, needSelfJudge: false }` 这行的作用**：让解析区的措辞从"请自评"变成"答对了/答错了"，且 `canJudge` 立刻收敛为 false（`needSelfJudge` 没了）—— 不自造状态机，靠已有派生值收敛。

`Drill.vue` 的 actions 区补一行提示（放在 `<div class="actions">` 之后）：

```vue
      <p v-if="drill.judgedTip.value" class="hint">{{ drill.judgedTip.value }}</p>
```

- [ ] **Step 2: `Drill.vue` 把两个按钮接上**

```vue
        <div v-if="drill.canJudge.value" class="judge-actions">
          <button type="button" class="primary" :disabled="drill.judging.value" @click="drill.judge(true)">
            我答对了
          </button>
          <button type="button" class="ghost" :disabled="drill.judging.value" @click="drill.judge(false)">
            我答错了
          </button>
        </div>
```

**关键判据（裁定七）**：`showAnswer` 的两个条件缺一不可 —— `result` 存在（刷新后本来就没有答案可给）**且** `!needSelfJudge || revealed`。不许把它简化成 `v-if="drill.result.value"`，那等于把裁定七擦掉。

- [ ] **Step 3: 绿灯**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check && npm run build-only
```

- [ ] **Step 4: 浏览器实跑（简答题）**

用 Task 2 落盘的 `type=5` 样本 qid，走 `/practice/drill?questionId=<那个 id>`：

1. 提交后**只**有自评按钮，屏幕上没有参考答案 —— F12 看 `answer/submit` 的响应里 `correctAnswerJson` 其实**有值**（后端无条件返回，事实清单 7），这条对比就是裁定七的活证据
2. 点"我答对了" → 参考答案与解析展开、`statDelta` 的 `total`/`correct` 同时 +1（**覆盖后**的值，不是加出来的）
3. 刷新页面重进本题 → `answerStatus` 已是 1，不再出自评按钮
4. **刷新后自评的那条路径**（用另一道还没判的简答）：判完只有"已记录自评：…"一行，**没有参考答案可展开** —— 因为参考答案只在 `answer/submit` 的响应里给，`question/current` 是答题态不含真值。这是后端契约的边界，不是前端漏做；把它如实记进执行记录
5. 40900「该记录已完成自评」的触发方式：**开两个标签页**进同一道待自评的题，A 判完再在 B 里点一次（B 拿的是旧 `recordId`）→ 错误条显示后端那句原文。不要为了让它出现而手工改库

实测数字与 F12 截图路径写进执行记录。

- [ ] **Step 5: 提交**

```bash
git add -- src/composables/useDrill.ts src/views/Practice/Drill.vue
git commit -m "自评流：判完才展开参考答案，recordId 两个来源都接上，统计按快照覆盖" -- src/composables/useDrill.ts src/views/Practice/Drill.vue
```

---

## Task 12：`AnswerCard.vue` + 重做流 + 收藏星标

**Files:**
- Create: `src/components/practice/AnswerCard.vue`
- Modify: `src/views/Practice/Drill.vue`（把 Task 10 注释掉的 `<AnswerCard>` 恢复成真用法）

**Interfaces:**
- Consumes: `DrillCardCell`（Task 10）
- Produces: `props: { cells: DrillCardCell[]; currentId: number | null }`，`emit('select', questionId: number)`

- [ ] **Step 1: 写 `AnswerCard.vue`**

```vue
<!-- src/components/practice/AnswerCard.vue -->
<script setup lang="ts">
import type { DrillCardCell } from '../../composables/useDrill'

defineProps<{ cells: DrillCardCell[]; currentId: number | null }>()
const emit = defineEmits<{ select: [questionId: number] }>()

const TITLE: Record<string, string> = {
  idle: '未作答', correct: '答对', wrong: '答错', pending: '待自评',
}
</script>

<template>
  <div class="card-area">
    <p class="legend">
      <span v-for="(text, state) in TITLE" :key="state" class="legend-item">
        <i class="dot" :class="`dot--${state}`" />{{ text }}
      </span>
    </p>
    <div class="grid">
      <button
          v-for="c in cells"
          :key="c.questionId"
          class="cell"
          :class="[`cell--${c.state}`, { 'cell--now': c.questionId === currentId }]"
          type="button"
          :title="`第 ${c.index} 题 · ${TITLE[c.state]}`"
          @click="emit('select', c.questionId)"
      >{{ c.index }}</button>
    </div>
  </div>
</template>

<style scoped>
.card-area { display: flex; flex-direction: column; gap: 8px; }
.legend { display: flex; gap: 12px; margin: 0; font-size: 12px; color: var(--text-muted); }
.legend-item { display: inline-flex; align-items: center; gap: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot--idle { background: var(--p-idle); border: 1px solid var(--divider); }
.dot--correct { background: var(--p-correct); }
.dot--wrong { background: var(--p-wrong); }
.dot--pending { background: var(--p-pending); }
.grid { display: flex; flex-wrap: wrap; gap: 6px; }
.cell {
  width: 32px; height: 32px; border-radius: 8px; font: inherit; font-size: 12px; cursor: pointer;
  border: 1px solid var(--divider); background: var(--p-idle); color: var(--text-secondary);
}
.cell--correct { background: var(--p-correct); border-color: var(--p-correct); color: #fff; }
.cell--wrong { background: var(--p-wrong); border-color: var(--p-wrong); color: #fff; }
.cell--pending { background: var(--p-pending); border-color: var(--p-pending); color: #3b2a00; }
.cell--now { outline: 2px solid var(--primary-500); outline-offset: 1px; }
</style>
```

四态色只从 `--p-*` 取（这些变量定义在 `Layout.vue` 的 `.practice-shell` 上，AnswerCard 是它的后代）—— **本任务不许再新增十六进制值**（`color: #fff` 那两个是态色之上的前景，可保留；若 `npm run type-check` 后你觉得扎眼，改成 `var(--primary-contrast)`，别硬编码）。

- [ ] **Step 2: `Drill.vue` 恢复真用法**

```vue
import AnswerCard from '../../components/practice/AnswerCard.vue'
...
    <AnswerCard
        :cells="drill.cardCells.value"
        :current-id="drill.currentId.value"
        @select="(id: number) => drill.open({ kind: 'question', questionId: id })"
    />
```

- [ ] **Step 3: 浏览器实跑**

1. 答题卡格数 == `subject/list` 里这科的 `questionCount`（语文 4、数学 3）
2. 答完一题，那一格当场变色（本地写的那一格，用 `submit` 响应推出来）
3. 刷新页面 → 格子颜色从 `question/page` 的 `answerStatus` 重算，仍与刚才一致
4. 点任一格 → `?questionId=` 进重做流，作答框按 `lastUserAnswerJson` 回填（答过的题不会变空白）
5. 当前格的描边跟着走
6. 慢网络下连点两个科目的"练习" → 最终答题卡属于最后那个（竞态判据，seqGuard 的活证据）

- [ ] **Step 4: 绿灯 + 提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check && npm run build-only
git add -- src/components/practice/AnswerCard.vue src/views/Practice/Drill.vue
git commit -m "答题卡四态与重做流：颜色只从局部令牌取，点格子走 questionId 分支" -- src/components/practice/AnswerCard.vue src/views/Practice/Drill.vue
```

---

## Task 13：`useWrong.ts` + `Wrong.vue`

**Files:**
- Create: `src/composables/useWrong.ts`, `src/views/Practice/Wrong.vue`
- Modify: `src/router/index.ts`（补 `practice-wrong`）

**Interfaces:**
- Consumes: `fetchWrongPage` / `markMastered`、`normalizePage`、`clampPageSize`、`formatDateTime`、`usePracticeStore`
- Produces: `useWrong(getSubjectId)` → `{ rows, page, status, loading, error, reload, next, prev, setStatus, master }`；`rows: ComputedRef<(WrongItem & { mastered: boolean })[]>`

- [ ] **Step 1: `useWrong.ts`**

```ts
// src/composables/useWrong.ts
import { computed, ref } from 'vue'
import { fetchWrongPage, markMastered } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage, type PageView } from '../api/practice/paging'
import type { WrongItem } from '../api/practice/types'

export type WrongFilter = 1 | 2 | null      // null = 全部；后端只认 1/2（其它 40000）

const SIZE = 20

/** 就地摘行时 pages 必须一起重算，否则最后一页会留下一个"能点但必空"的下一页 */
function shrinkTotal<T>(view: PageView<T>): PageView<T> {
  const total = Math.max(0, view.total - 1)
  return { ...view, total, pages: Math.ceil(total / view.pageSize) }
}

export function useWrong(getSubjectId: () => number | null) {
  const raw = ref<WrongItem[]>([])
  const page = ref<PageView<WrongItem>>({
    pageNum: 1, pageSize: SIZE, total: 0, pages: 0, list: [], hasPrev: false, hasNext: false,
  })
  const status = ref<WrongFilter>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const guard = createSeqGuard()

  async function reload(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const vo = await fetchWrongPage({
        subjectId, status: status.value ?? undefined,
        pageNum: page.value.pageNum, pageSize: clampPageSize(page.value.pageSize),
      })
      if (!guard.isCurrent(mine)) return
      raw.value = vo.list
      page.value = normalizePage(vo)
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  function go(delta: number): void {
    const next = page.value.pageNum + delta
    if (next < 1 || next > page.value.pages) return
    page.value = { ...page.value, pageNum: next }
    void reload()
  }

  function setStatus(value: WrongFilter): void {
    status.value = value
    page.value = { ...page.value, pageNum: 1 }   // 换筛选条件还停在第 3 页 = 空白页
    void reload()
  }

  /** 成功后本地摘掉那一行并把 total/pages 一起收敛：整页重拉会让用户以为没生效 */
  async function master(questionId: number): Promise<void> {
    const mine = guard.next()
    error.value = null
    try {
      const ok = await markMastered(questionId)
      if (!guard.isCurrent(mine)) return
      if (ok) {
        raw.value = raw.value.filter(r => r.questionId !== questionId)
        page.value = shrinkTotal(page.value)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  const rows = computed(() => raw.value.map(r => ({ ...r, mastered: r.status === 2 })))

  return { rows, page, status, loading, error, reload, master, setStatus, go }
}
```

`markMastered` 返回 `false` 时什么都不改（后端把"这条已经不是未掌握"如实回成 false），页面靠下一次的 `reload` 收敛。

- [ ] **Step 2: `Wrong.vue`**

```vue
<!-- src/views/Practice/Wrong.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { useWrong, type WrongFilter } from '../../composables/useWrong'
import { formatDateTime } from '../../utils/datetime'

const router = useRouter()
const { current: currentSubject, ensure } = useSubjects()
const wrong = useWrong(() => currentSubject.value?.id ?? null)

onMounted(async () => { await ensure(); if (currentSubject.value) void wrong.reload() })

const FILTERS: { value: WrongFilter; label: string }[] = [
  { value: null, label: '全部' },
  { value: 1, label: '未掌握' },
  { value: 2, label: '已掌握' },
]

function redo(questionId: number): void {
  void router.push({ name: 'practice-drill', query: { questionId: String(questionId) } })
}
</script>

<template>
  <section class="wrong">
    <header class="head">
      <h1 class="title">{{ currentSubject?.name ?? '未选题' }} · 错题本</h1>
      <div class="filters">
        <button v-for="f in FILTERS" :key="f.label" class="chip"
                :class="{ 'chip--on': wrong.status.value === f.value }"
                type="button" @click="wrong.setStatus(f.value)">{{ f.label }}</button>
      </div>
    </header>

    <ErrorBar v-if="wrong.error.value" :message="wrong.error.value"
              @dismiss="wrong.error.value = null" />

    <EmptyState v-if="!wrong.loading.value && wrong.rows.value.length === 0 && wrong.page.value.total === 0"
                title="这个筛选下没有错题" hint="答错的题会进这里；重做对了以后可以标成已掌握。" />

    <ul v-else class="list">
      <li v-for="r in wrong.rows.value" :key="r.questionId" class="row glass-lite">
        <div class="main-col">
          <p class="line1">
            <span class="idx">第 {{ r.index ?? '—' }} 题</span>
            <span class="type">题型 {{ r.type }}</span>
            <span class="count">错 {{ r.wrongCount }} 次</span>
            <span v-if="r.mastered" class="ok">已掌握</span>
          </p>
          <p class="brief">{{ r.titleBrief }}</p>
          <p class="meta">上次答错：{{ formatDateTime(r.lastWrongAt) }}</p>
        </div>
        <div class="acts">
          <button class="ghost" type="button" @click="redo(r.questionId)">重做</button>
          <button v-if="!r.mastered" class="primary" type="button"
                  @click="wrong.master(r.questionId)">已掌握</button>
        </div>
      </li>
    </ul>

    <footer class="pager">
      <button class="ghost" type="button" :disabled="!wrong.page.value.hasPrev" @click="wrong.go(-1)">上一页</button>
      <span class="page-no">{{ wrong.page.value.pageNum }} / {{ wrong.page.value.pages || 1 }}</span>
      <button class="ghost" type="button" :disabled="!wrong.page.value.hasNext" @click="wrong.go(1)">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.wrong { display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.title { margin: 0; font-size: 17px; flex: 1; min-width: 0; }
.filters { display: flex; gap: 6px; }
.chip { padding: 6px 12px; border: 1px solid var(--divider); border-radius: 999px;
  background: var(--p-idle); color: var(--text-secondary); font: inherit; cursor: pointer; }
.chip--on { border-color: var(--primary-500); color: var(--text-primary); font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid var(--divider); border-radius: 12px; }
.main-col { flex: 1; min-width: 0; }
.line1 { display: flex; gap: 10px; margin: 0 0 4px; font-size: 12px; color: var(--text-muted); }
.ok { color: var(--p-correct); }
.brief { margin: 0; font-size: 14px; }
.meta { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
.acts { display: flex; gap: 8px; flex: none; }
.ghost, .primary { padding: 6px 12px; border-radius: 8px; font: inherit; cursor: pointer;
  border: 1px solid var(--divider); background: transparent; color: var(--text-secondary); }
.primary { background: var(--primary-500); border-color: var(--primary-500); color: var(--primary-contrast); }
.ghost:disabled { opacity: .5; cursor: default; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.page-no { font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 3: 补路由、绿灯、实跑**

```ts
        { path: 'wrong', name: 'practice-wrong', component: () => import('../views/Practice/Wrong.vue') },
```

浏览器：① 列表非空且 `titleBrief` 是截断标题（不是完整题干 —— 后端脱敏口径，别去拼）；② 点"重做"进 `?questionId=` 且回填上次作答；③ 答对后回错题本，"已掌握"点掉 → 该行当场消失、`total` 减 1；④ 筛选切"已掌握"能看到它；⑤ 单页时"上一页/下一页"都是 disabled（`pages=1`）。

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check && npm run build-only
git add -- src/composables/useWrong.ts src/views/Practice/Wrong.vue src/router/index.ts
git commit -m "错题本：三档筛选、标记已掌握就地摘行、重做跳练习页并回填" -- src/composables/useWrong.ts src/views/Practice/Wrong.vue src/router/index.ts
```

---

## Task 14：`useFavorite.ts` + `Favorite.vue`

**Files:**
- Create: `src/composables/useFavorite.ts`, `src/views/Practice/Favorite.vue`
- Modify: `src/router/index.ts`（补 `practice-favorite`）

**Interfaces:**
- Consumes: `fetchFavoritePage` / `toggleFavorite`、`normalizePage`、`formatDateTime`
- Produces: `useFavorite(getSubjectId)` → `{ rows, page, loading, error, reload, next, prev, unfavorite }`

- [ ] **Step 1: `useFavorite.ts`**

```ts
// src/composables/useFavorite.ts
import { computed, ref } from 'vue'
import { fetchFavoritePage, toggleFavorite } from '../api/practice/wrongFavorite'
import { createSeqGuard } from '../api/practice/http'
import { errorText } from '../api/practice/errors'
import { clampPageSize, normalizePage, type PageView } from '../api/practice/paging'
import type { FavoriteItem } from '../api/practice/types'

const SIZE = 20

/** 就地摘行时 pages 必须一起重算（与 useWrong 同一件事），否则留下"能点但必空"的下一页 */
function shrinkTotal<T>(view: PageView<T>): PageView<T> {
  const total = Math.max(0, view.total - 1)
  return { ...view, total, pages: Math.ceil(total / view.pageSize) }
}

export function useFavorite(getSubjectId: () => number | null) {
  const raw = ref<FavoriteItem[]>([])
  const page = ref<PageView<FavoriteItem>>({
    pageNum: 1, pageSize: SIZE, total: 0, pages: 0, list: [], hasPrev: false, hasNext: false,
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const guard = createSeqGuard()

  async function reload(): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = guard.next()
    loading.value = true
    error.value = null
    try {
      const vo = await fetchFavoritePage({
        subjectId, pageNum: page.value.pageNum, pageSize: clampPageSize(page.value.pageSize),
      })
      if (!guard.isCurrent(mine)) return
      raw.value = vo.list
      page.value = normalizePage(vo)
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    } finally {
      if (guard.isCurrent(mine)) loading.value = false
    }
  }

  /** 取消收藏：后端不看插入/删除返回值、只回读真实状态，所以前端同样只信响应里的 favorited */
  async function unfavorite(questionId: number): Promise<void> {
    const subjectId = getSubjectId()
    if (subjectId === null) { error.value = '请先选择一个科目'; return }
    const mine = guard.next()
    error.value = null
    try {
      const stillFavorited = await toggleFavorite(subjectId, questionId)
      if (!guard.isCurrent(mine)) return
      if (!stillFavorited) {
        raw.value = raw.value.filter(r => r.questionId !== questionId)
        page.value = shrinkTotal(page.value)
      }
    } catch (err) {
      if (guard.isCurrent(mine)) error.value = errorText(err)
    }
  }

  function go(delta: number): void {
    const next = page.value.pageNum + delta
    if (next < 1 || next > page.value.pages) return
    page.value = { ...page.value, pageNum: next }
    void reload()
  }

  const rows = computed(() => raw.value)
  return { rows, page, loading, error, reload, go, unfavorite }
}
```

- [ ] **Step 2: `Favorite.vue`**

照 `Wrong.vue` 的结构写，差异只有四处（其余样式复用同一个作用域块）：

```vue
<!-- src/views/Practice/Favorite.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/practice/EmptyState.vue'
import ErrorBar from '../../components/practice/ErrorBar.vue'
import { useSubjects } from '../../composables/useSubjects'
import { useFavorite } from '../../composables/useFavorite'
import { formatDateTime } from '../../utils/datetime'

const router = useRouter()
const { current: currentSubject, ensure } = useSubjects()
const fav = useFavorite(() => currentSubject.value?.id ?? null)

onMounted(async () => { await ensure(); if (currentSubject.value) void fav.reload() })

function redo(questionId: number): void {
  void router.push({ name: 'practice-drill', query: { questionId: String(questionId) } })
}
</script>

<template>
  <section class="fav">
    <header class="head">
      <h1 class="title">{{ currentSubject?.name ?? '未选题' }} · 收藏本</h1>
      <button class="ghost" type="button" :disabled="fav.loading.value" @click="fav.reload()">
        {{ fav.loading.value ? '加载中…' : '刷新' }}
      </button>
    </header>

    <ErrorBar v-if="fav.error.value" :message="fav.error.value" @dismiss="fav.error.value = null" />

    <EmptyState v-if="!fav.loading.value && fav.rows.value.length === 0"
                title="还没有收藏的题目" hint="在练习页右上点「收藏本题」就会进这里。" />

    <ul v-else class="list">
      <li v-for="r in fav.rows.value" :key="r.questionId" class="row glass-lite">
        <div class="main-col">
          <p class="line1">
            <span class="idx">第 {{ r.index ?? '—' }} 题</span>
            <span class="type">题型 {{ r.type }}</span>
          </p>
          <p class="brief">{{ r.titleBrief }}</p>
          <p class="meta">收藏于 {{ formatDateTime(r.createdAt) }}</p>
        </div>
        <div class="acts">
          <button class="ghost" type="button" @click="redo(r.questionId)">重做</button>
          <button class="primary" type="button" @click="fav.unfavorite(r.questionId)">取消收藏</button>
        </div>
      </li>
    </ul>

    <footer class="pager">
      <button class="ghost" type="button" :disabled="!fav.page.value.hasPrev" @click="fav.go(-1)">上一页</button>
      <span class="page-no">{{ fav.page.value.pageNum }} / {{ fav.page.value.pages || 1 }}</span>
      <button class="ghost" type="button" :disabled="!fav.page.value.hasNext" @click="fav.go(1)">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
/* 与 Wrong.vue 同构，逐条抄它的作用域样式；类名换掉的部分只有一处：.fav 顶替 .wrong */
.fav { display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; }
.title { margin: 0; font-size: 17px; flex: 1; min-width: 0; }
.ghost, .primary { padding: 6px 12px; border-radius: 8px; font: inherit; cursor: pointer;
  border: 1px solid var(--divider); background: transparent; color: var(--text-secondary); }
.primary { background: var(--primary-500); border-color: var(--primary-500); color: var(--primary-contrast); }
.ghost:disabled { opacity: .5; cursor: default; }
.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid var(--divider); border-radius: 12px; }
.main-col { flex: 1; min-width: 0; }
.line1 { display: flex; gap: 10px; margin: 0 0 4px; font-size: 12px; color: var(--text-muted); }
.brief { margin: 0; font-size: 14px; }
.meta { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
.acts { display: flex; gap: 8px; flex: none; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.page-no { font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 3: 补路由、绿灯、实跑**

```ts
        { path: 'favorite', name: 'practice-favorite', component: () => import('../views/Practice/Favorite.vue') },
```

浏览器：① 练习页收藏一题 → 收藏本出现它；② "取消收藏" → 该行就地消失；③ 关掉练习页直接进收藏本再点重做 → 仍能作答（重做流不依赖先访问过练习页）；④ 全部取消后 → 空态而不是"加载失败"。

```bash
cd /f/AAAJAVA/code/EZ_frontend && npm test && npm run type-check && npm run build-only
git add -- src/composables/useFavorite.ts src/views/Practice/Favorite.vue src/router/index.ts
git commit -m "收藏本：分页、就地取消、重做复用练习页的 questionId 分支" -- src/composables/useFavorite.ts src/views/Practice/Favorite.vue src/router/index.ts
```

---

## Task 15：全量端到端实跑 + 文档回写

**Files:**
- Create（仓库外）: `C:/Users/Administrator/.qoder-cn/tmp/F--AAAJAVA-code-EZ_frontend/drill/` 下的截图与快照文本
- Modify: `docs/superpowers/plans/2026-10-26-practice-frontend-drill.md`（本文件"执行记录"）
- Modify: `docs/superpowers/specs/2026-10-26-practice-frontend-design.md`（实测与原设计不符处，就地加带日期的更正）

- [ ] **Step 1: 前提取证**

```bash
netstat -ano | grep -E ":8100|:8102|:8103" | grep LISTENING
cd /f/AAAJAVA/code/EZ_frontend && npm run dev > "C:/Users/Administrator/.qoder-cn/tmp/F--AAAJAVA-code-EZ_frontend/drill/dev.log" 2>&1 &
```

缺服务就停下来报给用户，**不许用"跳过实跑"换绿灯**。

- [ ] **Step 2: 用浏览器工具把 spec §7.5 的 11 条逐条打完**

登录口令由用户手输（或 `EZ_PW` 环境变量，**不进任何文件与日志**；截图前确认画面里没有口令）。每条记录：判据、实测到的数字/文案、截图文件名。至少这三条要留硬证据：

- 第 3 条：答题卡格数与 `questionCount` 相等（语文 4 / 数学 3）
- 第 5 条：简答提交后屏幕上没有参考答案，而 F12 的响应里 `correctAnswerJson` 有值（裁定七的实现证据）
- 第 8 条：慢网络连切两科，最终答题卡属于最后那个（竞态）

- [ ] **Step 3: 负例三条**

1. 停掉 PracticeModule（8102 消失）→ 页面错误条文案是"无法连接服务器，请确认网关已启动"
2. 退出登录 → 访问 `/practice` 跳 `/login?redirect=…`
3. 手动把 URL 改成 `/practice/drill?questionId=999999` → 错误条显示"内容可能已更新，请刷新重试"（40400），**页面不许崩**

- [ ] **Step 4: 回写两份文档**

执行记录里贴：真实命令与输出、`npm test` 的 `Test Files / Tests` 两行、`npm run type-check` 与 `npm run build-only` 的结果、11 条判据的实测结论、与 spec 不符之处（例如 `icon` 的真实形态、`blankMode` 的最终定案）。

- [ ] **Step 5: 提交**

```bash
cd /f/AAAJAVA/code/EZ_frontend
git add -- docs/superpowers
git commit -m "练习侧前端端到端：11 条浏览器判据逐条实测 + spec 三处按实测更正" -- docs/superpowers
```

---

## Task 16：主线自查（不派子代理）

用户规则：实现与审查都在主线。**报告里必须明写"未做独立审查轮次"**。每条都要给文件:行号，不接受"我看过了"。

- [ ] **1. 契约一致**：9 个接口的路径与字段名逐个对过 `PracticeModule` 的 controller 与 VO；`buildQuery` 的"跳过空值"能证明 `current` 永远不会同时送 `subjectId` 与 `questionId`。
- [ ] **2. `userAnswerJson` 只有一个出口**：`grep -rn "userAnswerJson" src/` 的命中必须只在 `answer.ts`（encode/decode）与 `question.ts`（表单字段名）里；**不许有第二处手工拼 JSON**。
- [ ] **3. 裁定七没被擦掉**：`showAnswer` 的计算式仍是 `!needSelfJudge || revealed`；Task 11 的浏览器证据（响应有值、屏幕没有）在执行记录里。
- [ ] **4. 统计是覆盖不是相加**：`grep -n "stat.value =" src/composables/useDrill.ts` 的三处赋值都是整份快照，没有 `+ 1`。
- [ ] **5. 竞态三处都在**：`useSubjects` / `useDrill` / `useWrong` / `useFavorite` 每个 async 入口都有 `guard.next()` 与两个 `isCurrent` 检查点（catch/finally 也算）。
- [ ] **6. 分页口径**：`hasNext`/`hasPrev` 只用 `pages`/`pageNum`；`grep -n "list.length" src/` 不许出现在分页判据里。
- [ ] **7. 越界与空态**：`pageSize` 前端夹到 ≤100；空列表走 `EmptyState`，`ErrorBar` 只在有 error 时渲染。
- [ ] **8. 测试数与绿灯**：贴 `npm test` 的完整尾巴（node:test + vitest 两段）与 `npm run type-check`、`npm run build-only` 的真实结果。
- [ ] **9. 依赖与秘密**：`git diff` 里 `package.json` 只多 `vitest`；新增行 `grep -nE "password|secret|123456|Bearer |token="` 零命中（`request.ts` 的既有实现不算）。
- [ ] **10. 没越界**：`git status --short` 不含 `AIModule/**`、`GatewayModule/**`、后端任何文件，也不含 `src/App.vue`、`src/components/text/ShinyText.vue`、`src/views/Home.vue` 的改动。
- [ ] **11. 未覆盖的缺口要明写**（不许省略）：`.vue` 组件零自动测试（裁定二），模板类错误只靠 `vue-tsc` + `vite build`；`mode=3` 的"优先错题"策略正确性不在前端验证范围（后端职责，段 3 已取证）；考试侧 8 接口未接；`icon` 用首字代替真实图标是临时口径（后端给的是 `"icon-chinese"` 这种没有对应资源的类名 token）；科目被停用的 40900 只在 `question/page` 这一条入口上验过，`wrong/page`/`favorite/page` 走的是同一个 `SubjectGuards` 但没各自点一遍；**刷新页面后来自评没有参考答案可展开**（真值只在 `answer/submit` 响应里给，`question/current` 是答题态），这条只能靠 `judgedTip` 给反馈 —— 要让它有答案，得给成绩单类接口开一个"交卷后/判完后"的真值出口，那是后端新接口，不在本计划范围。
- [ ] **12. 计划里被就地改掉的东西**：见文末"计划自查记录"，执行时如果又发现同类（计划写的 API/字段在代码里不存在），**改计划而不是改代码去迁就计划**，并追加到那一节。

---

## 与其他任务的接缝（本计划留下的、后续必须接住的口子）

| 接缝 | 归谁 | 具体待办 |
|---|---|---|
| 考试侧 8 接口 | 下一个子项目 | `QuestionBody.vue` 与 `encodeUserAnswer` 复用时**不许新写编码器**；`41001/41002` 的文案与"超时后懒归档"要前端配合（`deadlineAt` 对表在服务端） |
| `blankMode` | Task 2 定 | 若将来题目占位符形态变化，`BLANK_MODE` 与 `BLANK_MARKER` 要一起重定，并补对应 spec 用例 |
| 后端若在 `needSelfJudge` 时不再返回答案 | 后端 | 裁定七的前端逻辑要同步简化（`correctAnswerJson` 为空时不渲染展开区），**不能反过来依赖后端配合** |
| `--p-*` 四态色 | 样式轮次 | 三个十六进制值集中在 `Layout.vue` 一处；样式升级那轮应把它们提到全局令牌，并删掉本模块的局部定义 |
| `.vue` 组件测试 | 未排期 | 若将来要加，`vitest` 需要 `environment: 'jsdom'` + `@vue/test-utils`，那是**新的两个依赖**，要重新裁定 |
| 端到端留下的真实数据 | 用户 | 本轮在 `test918`（`user_id=10`）名下新增的作答记录/错题/收藏是**正常业务数据**，不需要清理；若要清，SQL 由执行者写出，**不代执行** |

---

## 计划自查记录（写完计划后逐项过，问题在写计划时就改掉，不留给执行者）

**spec 覆盖核对**（spec §2–§7 每一条都能指到一个任务）：分层与文件清单→Task 3/4/5/6/7/8/9/10/12/13/14；9 接口契约与形状校验→Task 3+6；`userAnswerJson` 单一出口→Task 4（+Task 16 第 2 条）；三种取题模式→Task 10；`statDelta` 是快照→Task 10/11（+Task 16 第 4 条）；答题卡四态→Task 4/12；竞态 seq 丢弃→Task 5/7/10/13/14（+Task 16 第 5 条）；分页口径与 `pageSize` 夹住→Task 5/13/14；错误映射表→Task 5/8；裁定七（隐藏参考答案）→Task 10/11；裁定八（登录门）→Task 8；测试床与双运行器→Task 1；类型检查门补测试文件→Task 1；浏览器 11 条→Task 8/10/12/13/14/15。无遗漏。

**写计划过程中抓到并就地改掉的 10 处**（都是"会在执行时炸"的那类，不是文字问题）：

1. **`useDrill` 原本只有一个 seq guard** —— 进入页面时 `loadCard()` 与 `open()` 是并发的两条请求，共用一个 guard 会让后发的一条把先发的判成过期，**答题卡永远空**。改成 `cardGuard` / `flowGuard` / `favGuard` 三个。这是最容易"绿灯通过、页面空着"的一种错。
2. **`api.spec.ts` 期望 `wrong/page` 的 URL 带 `pageNum=1&pageSize=20`，而实现直接把入参摊进 `buildQuery`** —— `undefined` 会被丢掉，实测必红。改成在取数函数里定死默认值（`pageNum ?? 1`、`clampPageSize(pageSize)`），URL 稳定才可测。
3. **`open(target: DrillTarget)` 的参数与同名 ref 相撞**（`target.value = target` 读起来像自赋值）→ 参数改名 `next`。
4. **`subjectStat()` / `setStat()` 是死代码**（一个把原值写回自己，一个没人调）→ 删掉；科目统计的初值改由 `useSubjects().current` 渲染，并在正文里写明"两条来源不许互相初始化"。
5. **一处不存在的导出**（`ANSWER_CARD_STATUS`）→ 删。它是我顺手编的名字，正是 Task 16 第 12 条要防的那类。
6. **`it.skipIf` 被我写成 `expect.skipIf`**，并且 `blankSlots` 的测试里塞了"用 Task 2 的真实题干替换这条注释"——那是**计划级的占位符**。改成合成题干 + `it.skipIf(BLANK_MODE !== 'counted')`，并把 `initialModel` 的断言写成与 `blankSlots` 对齐的形式（`?? ['']`），这样 Task 2 无论定成哪个模式都不必回头改测试。
7. **`ErrorBar` 里我写了第二个 `<script>` 块**（因为忘了 `<script setup>` 里 `defineEmits` 的返回值直接可用）→ 定稿只留一份正确写法。同类：`Layout.vue` 的 `@dismiss="error = null"` 改成 `dismissError()`，避免在模板里对解构出来的 ref 赋值这件事上赌编译器行为。
8. **就地摘行只减 `total` 不重算 `pages`** —— 最后一页会留下一个"能点但必空"的下一页。两处（`useWrong.master`、`useFavorite.unfavorite`）都改成 `shrinkTotal()`。
9. **`Drill.vue` 缺"换科目"的 watch**：点侧栏科目时人已经在 `/practice/drill`，路由不变、组件不重挂，原设计只 watch `route.query.questionId` —— **Task 15 的竞态判据（连切两科）会当场失败**。补了 `watch(() => currentSubject.value?.id, …)`。
10. **`QuestionBody` 的填空两条分支写成了永不可达 + 打字消失**：`blanks` 回退成 `?? ['']` 让数组永远非空（textarea 的 `v-else` 永不进），而 textarea 又绑了一个字符串 computed、`modelValue` 实际是数组 —— 输入内容立刻被回写成空串。改成 `slotCount`（只从 `blankSlots` 取，null 就是"走 textarea"的显式信号）+ `freeformText`/`setFreeform` 一对。这类错 `vue-tsc` 抓不到（类型都对），只有把分支条件读第二遍才会露出来。

**类型一致性抽查**：`PageVO.list`（不是 AI 模块的 `items`）全文一致；`DrillCardCell` 在 Task 10 定义、Task 12 消费同名；`CardState` 的四个值与 `patchCell` 的反查表一致；`useDrill` 返回对象里的名字与 `Drill.vue` 模板用到的名字逐个对得上（`cardCells`/`currentId`/`canJudge`/`showAnswer`/`judgedTip`）。

**已知不完美但刻意不做**：`useDrill`/`useWrong`/`useFavorite` 的异步流程本体没有自动测试（它们要网络，而裁定二只批了纯逻辑）；`shrinkTotal` 在 `useWrong.ts` 与 `useFavorite.ts` 各有一份（第二次出现，还差第三次才够抽出规则；抽到 `paging.ts` 也行，但那会把"就地摘行"这个业务动作塞进分页工具，等考试侧真的复用第二次再说）。

---

## 执行记录（执行时逐项填，命令与输出一起贴）

**填写规则**：贴真实输出（可截断）。中文从落盘文件读，别指望 GBK 控制台。红灯必须贴出真实报错，证明确实先红后绿。

### Task 1（完成，2026-10-26）

**先红**（`npx --no-install` 是为了拿到"没装"的真实证据而不是顺手装一遍）：

```
$ npx --no-install vitest run
npm error npx canceled due to missing packages and no YES option: ["vitest@5.0.5"]
```

装 `vitest@^5.0.5` 后 `package.json` 只 +1 行、`package-lock.json` +261 行，没有别的包被动。

**绿灯**：

```
$ npm test
ℹ tests 19  ℹ pass 19  ℹ fail 0          ← node --test 那 3 个既有文件（没改一行）
 Test Files  1 passed (1)
      Tests  2 passed (2)                 ← vitest 的 smoke.spec.ts
$ npm run type-check                      ← vue-tsc --build && vue-tsc --noEmit -p tsconfig.vitest.json
EXIT=0
```

**实测抓到的一条计划缺陷（第 11 处，且是"绿灯会撒谎"那类）**：`tsconfig.vitest.json` 里 `"exclude": []` 不是可选项。按原计划只写 `include` 时，`extends` 继承来的 `exclude: ["src/**/__tests__/*"]` 会把 include 命中的测试文件**全部滤空** —— 我往 `smoke.spec.ts` 里塞 `const _bogus: number = "not a number"`，`npm run type-check` 照样报绿。加 `"exclude": []` 之后同一条变异当场红：

```
src/api/practice/__tests__/smoke.spec.ts(16,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

删掉变异回绿。**所以"测试也进类型检查门"这条验收项，证据是那次变异，不是 EXIT=0。**

提交：`de2b529`（5 个文件：`package.json`、`package-lock.json`、`vitest.config.ts`、`tsconfig.vitest.json`、`smoke.spec.ts`）。`ShinyText.vue`(AM) 与 `Home.vue`(M) 一行未动。

`vitest.config.ts` 比计划多了一行 `test.env = { VITE_API_BASE: '' }`：`request.ts` 在模块加载时读 `import.meta.env.VITE_API_BASE`，测试里必须把它钉成空串才会走 `/gw`，否则 Task 6 的 URL 断言在另一条链路上绿。

### Task 2（完成，2026-10-26）

只读探针（`QuestionInventory.java`，仓库外 `…/tmp/F--AAAJAVA-code-EZ_frontend/probe/`，输出 `inventory.txt` UTF-8）：

```
== type 分布（status=1）== type=1 n=3 / type=2 n=1 / type=3 n=1 / type=4 n=1 / type=5 n=1，启用题总数 7
qid=4 subject=2 title=植物通过____作用将光能转化为化学能。 answer=["光合作用"]
```

判据核对：占位符 1 个、`answer_json` 槽 1 个 → 1/1 题命中（≥ 一半）→ **`blankMode='counted'`**。`freeform` 分支照计划留着并各有测试——库里只有 1 道填空题，样本量不足以把它当普适结论。

顺手钉了 Task 15 要点的真实 id：语文（科目 1）= `type1:1/6`、`type2:2`、`type5:5`；数学（科目 2）= `type1:7`、`type3:3`、`type4:4`。**五种题型都能点到，但判断/填空只在科目 2、多选/简答只在科目 1**，实跑必须来回切两科。

### Task 3（完成，2026-10-26）

**先红**：`npm run test:vitest -- …/types.spec.ts` → `Failed to resolve import "../types"`（`Test Files 1 failed / Tests no tests`）。

**第一次绿之前有两条真红**（不是配置问题，是实现的报文不够可诊断）：

```
AssertionError: expected [Function] to throw error matching /statDelta/
  but got 'POST /practice/answer/submit 响应格式异常：期望对象，实得 undefined'
```

`statDelta` 整个缺失时，我先走到 `asObject(undefined)`，报文只说"期望对象"——**看不出是哪个字段坏的**，而这正是形状校验存在的全部理由。没有把断言放宽成 `toThrowError(HttpError)`，而是把 `parseStatDelta` 改成接 `(o, where)` 并显式判缺失：报文变成 `…：statDelta 期望对象，实得 undefined`。两处调用点（submit / self-judge）一起改。

**绿灯**：

```
$ npm test
ℹ pass 19  ℹ fail 0                       ← node:test 三个文件（未动）
 Test Files  2 passed (2)
      Tests  24 passed (24)               ← smoke 2 + types 22
$ npm run type-check                      ← 无 error TS
```

22 条里有三条是"形状校验是不是活的"的直接证据：`越界页的真 total 必须照抄回来`（防"空 list 就当没题"）、`finished 形态里 answerStatus 也是 null 必须通过`（防把可空字段写成必填）、`待自评样本里 isCorrect 是 null 而不是 false`。

spec §2 的文件清单按本任务 Step 6 更正为 `types/answer/paging/errors/http` 五个文件，并写了拆分理由。提交：types.ts + fixtures.ts + types.spec.ts + spec 更正。

### Task 4（完成，2026-10-26）

**先红**：`npm run test:vitest -- …/answer.spec.ts` → `Test Files 1 failed / Tests no tests`（模块不存在）。

**绿灯**：`Tests 25 passed | 1 skipped (26)` —— 跳过的那条是 `freeform` 分支的断言，`BLANK_MODE='counted'` 下必然跳过，**它留在文件里是为了数据形态一变时测试先叫，不是为了凑数**。

三条值得单独说的判据：

- `多选的空数组回 null 而不是 []`：`[]` 会被 `encode` 拒，回填成 `[]` 等于给一题注定失败的态。这条是写 `decode` 时想明白的，不在原计划里。
- `编码结果是合法单值文档，拼上第二个值就不是`：`JSON.parse('"A" "B"')` 必抛 —— 这条把段 2 那次独立审查抓到的类缺陷钉在测试里（Jackson 宽松、MySQL 严格）。
- `提交后迁移：待自评优先于 isCorrect`：断言走的是 `parseAnswerSubmit(真实字节)` 而不是 `as never` 强类型塞进去（计划里原本写的是后者，那等于跳过契约层自己造一个"看起来像"的对象）。

提交：`answer.ts` + `answer.spec.ts`。

（从这里往下继续填。）
