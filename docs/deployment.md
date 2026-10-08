# 部署说明

当前生产结构是 Next.js / React 静态导出至 GitHub Pages、Render Express API 和 PostgreSQL。

## 网页前端

`.github/workflows/deploy-pages.yml` 在 `main` 更新时安装、检查并构建 `frontend-react/`，发布 `frontend-react/out/`；也可手动运行。仓库的 Pages Source 应设置为 GitHub Actions。

`public/CNAME` 指定 `texta.yanyihan.top`，构建后自动复制到导出目录；域名 DNS 继续指向 GitHub Pages。工作流中的 `NEXT_PUBLIC_API_BASE_URL` 指定 `https://api-texta.yanyihan.top`。本地前端使用 `frontend-react/.env.local` 配置本地 API。`public/site-config.js` 仅供旧版回退页面使用。

新路由、旧 `.html` 链接兼容、用户缓存迁移及回退流程见 [Next.js 前端](next-frontend.md)。网站切换不需要修改云端数据或更换域名。

## Express API

`render.yaml` 定义现有的 `texta-backend` 服务，构建与启动命令为：

```bash
npm install && npx prisma generate && npx prisma db push --skip-generate
npm start
```

配置 `DATABASE_URL`、`OPENAI_API_KEY`、模型名称、OpenAI-compatible 地址和 `FRONTEND_ORIGIN`。模型 Key、数据库密码、管理员密码、微信 AppSecret 与 FastSpring 凭据通过服务端环境变量配置；不要写入前端。

健康检查为 `/api/health`，目前返回服务状态、学习库版本、词典版本及 Render 提交标识。后端启动前会读取 `VocabularyDetail`，数据库结构不完整时启动失败。

## 数据库升级

当前仓库使用 `prisma db push` 同步结构，未提供正式迁移历史。升级已有数据库前先备份并检查 schema 变化，在测试环境验证后再发布；不要直接接受未知的数据丢失提示。

本次仓库整理不修改应用数据模型。数据库备份 `*.dump`、本地数据和凭据由 `.gitignore` 排除，原有本地文件保留。旧提交中已有文件不会因取消跟踪而自动消失。

## 可选功能与验收

- 微信身份配置与账号合并：[wechat-login.md](wechat-login.md)。小程序前端源码在本仓库之外。
- FastSpring 支付配置、测试模式和正式启用：[FASTSPRING_SETUP.md](../FASTSPRING_SETUP.md)。Test webhook 不能授予正式权益。
- Windows 安装包：[desktop.md](desktop.md)。构建工作流手动触发，安装包作为 Actions artifact 下载；Release 分发需要单独发布。

完成发布后检查登录、生成失败退款、学习库读写、政策页面和接口跨域；支付和小程序凭据的真实验收按各自文档执行。
