# Next.js 前端迁移

2026-10-08：网页改为 Next.js 16.4.0、React 19.2.4 与 TypeScript。登录、文章生成、收藏夹、生词本、导出、套餐、政策和管理员操作由 React 组件实现；没有加载旧版 `app.js`、`auth.js`，没有 iframe 包装。

## 页面与部署

| 路由 | 内容 |
| --- | --- |
| `/` | 登录与注册 |
| `/app/` | 两种生成模式、阅读、收藏、历史、生词本与账户设置 |
| `/pay/` | 后端套餐目录、订单创建、恢复和到账查询 |
| `/admin/` | 历史充值审核 |
| `/admin-usage/` | 用户使用统计及套餐管理 |
| `/admin-usage-detail/?userId=…` | 指定用户的每日、时段和近期使用详情 |
| `/terms/`、`/privacy/`、`/refund/` | 原有中英文政策正文 |

采用 `output: "export"`、`trailingSlash: true`。Pages 工作流检查并构建 `frontend-react/out/`，复制 CNAME 和 `.nojekyll`。`finish-export.cjs` 为原有 `.html` 链接生成跳转文件，保留查询参数与片段，并补齐 Next.js 16.2 静态导出分段预加载文件的兼容别名（[上游问题 #85374](https://github.com/vercel/next.js/issues/85374)）。

Express、PostgreSQL、积分与支付处理保持原接口。此迁移不引入 Next.js 服务端 API，也不需要新增 Vercel 服务。公开购买是否开放始终以 `/api/billing/plans` 为准。

## 本地运行

从仓库根目录：

```bash
npm ci --prefix frontend-react
cp frontend-react/.env.local.example frontend-react/.env.local
npm run dev --prefix frontend-react
```

前端为 `http://localhost:3001`，本地 API 为 `http://localhost:3000`。后端 `.env` 设置 `FRONTEND_ORIGIN=http://localhost:3001`。`NEXT_PUBLIC_API_BASE_URL` 在构建时写入前端，只能放公开地址。浏览器不能保存模型、数据库或支付密钥。

```bash
npm run lint --prefix frontend-react
npm test --prefix frontend-react
npm run build --prefix frontend-react
npm start --prefix frontend-react
```

最后一个命令使用本地静态服务器预览 `out/`，地址 `http://127.0.0.1:4173`。需要连接本地 API 时将后端允许的来源改为此地址，或通过浏览器网络夹具验证。不要使用 `next start` 启动静态导出。

## 旧资料与同步

- 登录令牌、主题、语言、字号、按用户保存的输入草稿和生词本视图继续读取原键。
- 旧版公共收藏、生词本、掌握状态和文件夹缓存首次迁入已验证账号的 `texta_next_library_v1_<userId>`。迁移记录会绑定首个已验证的账号；后续账号不会再次导入这些公共键。新缓存按用户隔离，旧键保留用于回退。
- 本地历史迁入 `texta_next_history_<userId>`，最多 80 条；草稿和历史仍只在当前浏览器保存。
- 收藏、词汇卡、删除标记、首次加入日期、文件夹、原文来源、双语对齐及混合词注均保留。短语使用原有的词汇标识格式，避免掌握状态脱离旧记录。
- 同步前先获取云端学习库并合并；读取失败时不上传不完整本地库。修改即时保存到本机，上传串行执行，请求期间的新修改会继续上传。网络错误可重试，失效账号的响应不会写入新账号。
- 新文章携带完整词汇卡，点击高亮词直接读取保存的数据。旧资料打开时批量补齐缺失卡片；失败仍可阅读原文并重试。
- 生成请求不自动重放，避免重复扣积分。失败时保留之前的可读文章。付款请求保留同一请求标识，待付款订单可关闭后恢复查询。

## 验证范围

前端的 Node 测试验证旧缓存与短语兼容、账号隔离、首次云端读取失败、同步期间编辑、删除标记、原文日期、双语定位和导出转义；核心后端测试继续验证 API 合约与计费。

浏览器验收使用内存中的 API 夹具，不创建真实账号、不扣真实积分、不创建真实付款。检查登录、两种生成、失败保留、收藏/文件夹、列表/卡片/日历、掌握状态、原文跳转、实际 PDF/Word 下载、主题/语言、移动端、旧链接、政策与管理员路由。真实支付结算和专用 PostgreSQL 集成验收仍是独立工作。

## 回退

旧版静态源码保留在 `public/`。需要回退时将 Pages 工作流的上传路径恢复为 `./public`，通过正常提交重新发布；不要改动云端数据库。新缓存与原键分开，旧版回退不会自动读取迁移后新增的浏览器历史，已同步的学习库仍可通过原 API 读取。
