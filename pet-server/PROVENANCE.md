# pet-server 的来源与本地改动

上游：https://github.com/PC2005-cloud/dsh-pet （MIT，见 `LICENSE`），本副本取自 0.4.0。

运行时状态不在这里，在 `~/.dsh/dsh-pet/`（AI 配置、记忆、日志、运行清单），
所以换目录或换机器都不用重配桌宠的模型。

本地改动（合上游时这两处要保住）：

1. `src/standalone/request-security.ts` — 放行 `Origin: http://127.0.0.1:<任意端口>`，
   否则前端 dev server 通过 iframe + 代理嵌入时被 403「不允许跨站请求」挡掉。
   已同步编译进 `lib/standalone.js`（搜 `isLoopbackOrigin`）。
2. `assets/preview/` 未纳入本仓库（67M 演示 GIF，运行时零引用）。

`node_modules` 也不在仓库里，需要时执行 `npm install --prefix pet-server`。
