# 开发与验证

首次配置见 [主 README](../README.md#getting-started)。所有命令从仓库根目录执行。

## 核心回归检查

```bash
npm test
```

主入口显式列出测试文件，避免把 `tests/web-wechat-preview.cjs` 这个持续运行的预览服务当成测试执行。覆盖微信身份与账号合并、套餐和积分、混合生成、双语生成、完整词汇卡、网页连接状态、学习库读写及句子翻译。

也可以分别运行 `npm run test:wechat`、`test:billing`、`test:mixed`、`test:bilingual`、`test:vocabulary`、`test:library`、`test:context`；网页连接状态运行 `node --test tests/web-wechat-state.cjs`。

核心检查使用模拟模型、内存数据库替身和 HTTP 夹具，不需要真实生成 API Key。这些检查不能证明真实 PostgreSQL 锁行为、所有模型输出、正式支付或跨设备数据同步。

## Next.js 前端检查

```bash
npm ci --prefix frontend-react
npm run lint --prefix frontend-react
npm test --prefix frontend-react
npm run build --prefix frontend-react
```

前端测试使用本地存储和 HTTP 替身，验证旧数据迁移、账号隔离、同步失败保护、并发修改、双语定位和导出转义。构建包含类型检查和静态路由验收。运行与浏览器验收范围见 [Next.js 前端](next-frontend.md)。Core tests 工作流在 PR 中执行这些检查，Pages 发布时也会检查前端。

## 真实数据库检查

计费集成测试需要预先初始化的专用数据库。`BILLING_TEST_DATABASE_URL` 的 schema 必须匹配 `texta_billing_test_[a-z0-9_]+`；未设置时跳过。它写入固定测试夹具，重复运行前应在专用测试环境清理夹具。

`tests/account-merge-database.cjs` 读取 `.env` 中的 `DATABASE_URL`，创建随机的 `texta_merge_test_*` schema 并在完成后移除。需连接允许创建 schema 的本地或专用测试数据库；不要以生产库作为测试入口。

```bash
node tests/account-merge-database.cjs
```

## 桌面客户端

```bash
npm run desktop:install
npm run test:desktop
npm run test:smoke --prefix desktop
```

安全策略检查限制站内导航及外部协议。Electron 冒烟检查验证渲染隔离、持久存储、外部跳转、Blob 下载、断网恢复，并读取线上登录页面。它使用 `output/desktop-smoke/` 下独立的测试资料，不处理真实订单。

## 界面预览与实验

`node tests/web-wechat-preview.cjs` 启动本地微信状态夹具，入口为 `http://127.0.0.1:4188/bound/app.html`，另有 `unbound`、`offline`、`paused` 和 `expired` 状态。用 Ctrl+C 结束预览。

生成实验见 [experiments/README.md](../experiments/README.md)。部分实验连接付费模型或登录态 CLI，应在阅读脚本和报告后单独运行，不包含在 `npm test` 中。
