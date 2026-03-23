# Texta

Texta is an IELTS vocabulary writing assistant website.  
You can input words or phrases, generate an English article with Chinese translation, highlight aligned vocabulary, and export results.

Texta 是一个 IELTS 词汇写作辅助网站。  
你可以输入单词或短语，生成英文文章与中文翻译，并进行对齐高亮与导出。

## Website URLs | 网站地址

- Frontend (GitHub Pages): https://yanyihann.github.io/Texta/
- Backend API (Render): https://texta-backend.onrender.com

## Core Features | 核心功能

- Login/Register with role system (`user` / `admin`)  
  登录注册与角色系统（普通用户 / 管理员）
- Daily usage quota  
  每日次数限制
  - Free user: 10/day
  - VIP user: 50/day
  - Admin: unlimited
- VIP flow with review  
  VIP 开通审核流程
  - User submits payment proof
  - Admin reviews and approves/rejects
  - VIP takes effect only after approval
- Article generation with required vocabulary coverage  
  文章生成并尽量覆盖输入词汇
- AI-based English/Chinese alignment highlighting (with sense markers)  
  AI 英中对齐高亮（含义项编号）
- Glossary panel: POS, senses, collocations, word formation, synonyms/antonyms  
  右侧词汇栏：词性、义项、搭配、词根词缀、同反义词
- Export preview and export to PDF / Word  
  导出预览 + PDF / Word 导出
- Favorites with reopen and rename  
  收藏夹（可重新打开与改标题）

## Input Rules | 输入规则

- Items are split by **newline** or **comma** only.  
  仅按 **换行** 或 **逗号** 分隔。
- Spaces are preserved inside phrases.  
  空格会保留在短语内部。

## Project Structure | 项目结构

- `public/index.html`: login/register page  
  登录注册页
- `public/app.html`: main app page  
  主功能页面
- `public/pay.html`: VIP payment proof submission page  
  VIP 凭证提交页
- `public/admin.html`: admin VIP review page  
  管理员审核页
- `public/app.js`: frontend main logic  
  前端主逻辑
- `public/pay.js`: payment request submit logic  
  支付申请提交逻辑
- `public/admin.js`: admin review logic  
  管理员审核逻辑
- `server.js`: backend API server  
  后端 API 服务
- `prisma/schema.prisma`: PostgreSQL data schema  
  PostgreSQL 数据模型
- `render.yaml`: Render deployment config  
  Render 部署配置

## Tech Stack | 技术栈

- Frontend: HTML + CSS + Vanilla JavaScript
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Deployment: GitHub Pages (frontend) + Render (backend)

## Database Models | 数据表

- `User`
- `Session`
- `UsageDaily`
- `VipRequest`

## Local Setup | 本地启动

1. Install dependencies  
   安装依赖

```bash
npm install
```

2. Configure `.env` (example)  
   配置环境变量（示例）

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/texta?schema=public
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai-proxy.org/v1
OPENAI_API_MODE=chat
OPENAI_MODEL=gpt-4o-mini
FRONTEND_ORIGIN=*
ADMIN_EMAIL=admin@example.com
ADMIN_NAME=Admin
ADMIN_PASSWORD=change_this_password
AUTH_TOKEN_TTL_MS=604800000
PORT=3000
```

3. Sync database schema  
   同步数据库结构

```bash
npm run db:push --skip-generate
```

4. Start server  
   启动服务

```bash
npm start
```

5. Optional: open Prisma Studio  
   可选：打开数据库可视化

```bash
npm run db:studio
```

## Deployment Notes | 部署说明

- GitHub Pages serves frontend only.  
  GitHub Pages 只托管前端静态页面。
- Backend API base URL is configured in `public/site-config.js`.  
  后端地址在 `public/site-config.js` 配置。
- Render backend must set:
  - `DATABASE_URL` (Render PostgreSQL internal URL)
  - `OPENAI_*` variables
  - `FRONTEND_ORIGIN=https://yanyihann.github.io`

## Payment QR Placeholder | 收款码占位

Replace this file with your own payment QR image:

请将下列文件替换为你的收款码图片：

- `public/assets/pay-qr.svg`

If you use PNG/JPG, update the image path in `public/pay.html`.

如果使用 PNG/JPG，请同步修改 `public/pay.html` 中的图片路径。
