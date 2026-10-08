# Texta Next.js 前端

当前网页的 React / TypeScript 实现，静态导出并发布至 [texta.yanyihan.top](https://texta.yanyihan.top/)。沿用根目录 Express API、Texta 主题与词汇资源。

从仓库根目录运行：

```bash
npm ci --prefix frontend-react
cp frontend-react/.env.local.example frontend-react/.env.local
npm run dev --prefix frontend-react
```

开发地址 http://localhost:3001，示例 API 地址 http://localhost:3000。

```bash
npm run lint --prefix frontend-react
npm test --prefix frontend-react
npm run build --prefix frontend-react
npm start --prefix frontend-react
```

静态预览地址 http://127.0.0.1:4173。线上构建中的 API 地址通过 `NEXT_PUBLIC_API_BASE_URL` 配置；此公开变量不能放密钥。

页面、旧链接与缓存迁移、同步保护和回退步骤见 [迁移文档](../docs/next-frontend.md)。
