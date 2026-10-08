<a id="readme-top"></a>

<div align="center">
  <a href="https://texta.yanyihan.top/"><img src="public/logo.svg" alt="Texta" width="168" /></a>
  <h1>Texta</h1>
  <p><strong>把你的英语词表，变成可以阅读、理解和复习的文章。</strong></p>
  <p>Turn your vocabulary into contextual reading and reusable study material.</p>
  <p>
    <a href="https://texta.yanyihan.top/">在线体验</a> ·
    <a href="docs/README.md">项目文档</a> ·
    <a href="docs/desktop.md">Windows 桌面版</a> ·
    <a href="https://github.com/YanYihann/Texta/issues/new">反馈问题</a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml"><img src="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml/badge.svg" alt="GitHub Pages deployment" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white" alt="Recommended Node.js 22+" /></a>
  <a href="prisma/schema.prisma"><img src="https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL and Prisma" /></a>
  <a href="desktop/package.json"><img src="https://img.shields.io/badge/Desktop-Electron-47848F?logo=electron&logoColor=white" alt="Electron desktop client" /></a>
</p>

![Texta 双语阅读与词汇解析界面](docs/images/reading.png)

<p align="center"><sub>项目现有界面截图：英文阅读、中文对照与词汇卡片。示例内容用于展示界面。</sub></p>

<details>
  <summary>目录</summary>
  <ol>
    <li><a href="#about">项目介绍</a></li>
    <li><a href="#features">核心功能</a></li>
    <li><a href="#usage">如何使用</a></li>
    <li><a href="#architecture">技术与架构</a></li>
    <li><a href="#getting-started">本地运行</a></li>
    <li><a href="#desktop">Windows 桌面版</a></li>
    <li><a href="#development">验证与开发</a></li>
    <li><a href="#deployment">部署</a></li>
    <li><a href="#structure">项目结构</a></li>
    <li><a href="#roadmap">后续方向</a></li>
    <li><a href="#contributing">参与贡献</a></li>
    <li><a href="#license">许可证与致谢</a></li>
  </ol>
</details>

<a id="about"></a>

## 项目介绍

Texta 是面向英语词汇学习者的全栈学习工具，适合雅思备考和日常词汇积累。输入需要掌握的单词或短语，生成包含这些词汇的文章，再通过词义、搭配、发音和原文例句理解用法。

学习材料可以继续保存到收藏夹和生词本，标记掌握状态，并导出 PDF 或 Word。中文界面默认启用，也可切换为英文。

当前线上版本使用 `public/` 中的静态前端和独立 Express API。`desktop/` 是连接同一线上站点的 Windows 客户端；`frontend-react/` 是开发中的 Next.js 前端，尚未替代线上版本。微信登录相关后端已包含在本仓库，微信小程序客户端源码不在本仓库内。

<a id="features"></a>

## 核心功能

| 功能 | 可以做什么 |
| --- | --- |
| 两种文章形式 | 双语文章提供英文正文和中文对照；中英混合故事把英语目标词嵌入中文情境；支持短文章模式 |
| 词汇输入 | 输入、编辑单词与短语，查看拼写建议；支持 TXT、Markdown、CSV、JSON 词表导入 |
| 语境理解 | 高亮目标词，查看本文义项、词性、英美音标、发音、搭配、构词及适用的近反义词 |
| 词典复用 | 生成正文时并行准备完整词汇卡，合法卡片持久缓存；阅读时点击直接显示已保存解析 |
| 阅读工作区 | 隐藏中文、切换阅读模式、移动端阅读、输入草稿和主题设置 |
| 保存与复习 | 文章收藏、收藏文件夹、生词本、掌握状态及学习库云同步；历史记录保存在客户端 |
| 账号连接 | 邮箱注册与登录、会话管理、网页微信绑定状态；支持小程序微信登录及验证原密码后关联已有邮箱账号 |
| 套餐与管理 | Free / Plus / Pro 积分额度、月度与永久权益、FastSpring 支付接入和管理员用量查看 |
| 离线材料 | 预览并导出 PDF / Word 学习材料 |
| 桌面使用 | Windows 10/11 x64 安装包、桌面快捷方式、下载保存对话框及断网重试页面 |

支付接入代码已实现，公开购买是否可用取决于服务端配置与支付商店状态；测试订单不授予正式权益。配置和验收记录见 [支付说明](FASTSPRING_SETUP.md)。

<a id="usage"></a>

## 如何使用

1. 打开 [Texta](https://texta.yanyihan.top/)，注册或登录。
2. 粘贴词表，例如 `sustainable, resilient, adapt, perspective, thrive, balance`，或导入词汇文件。
3. 检查词条和拼写，选择中英混合或双语文章；需要较短内容时开启短文章模式。
4. 生成后阅读文章，点击高亮词查看语境义项及已准备的词汇卡。
5. 收藏文章，把陌生词加入生词本，复习后更新掌握状态。
6. 按需导出 PDF / Word，继续离线阅读。

生成结果由模型提供，词义和用法仍需结合原文核对。生成失败会尝试退回预留积分；已成功保存的通用词典卡可继续复用。

<a id="architecture"></a>

## 技术与架构

| 部分 | 当前实现 |
| --- | --- |
| 线上前端 | HTML、CSS、JavaScript；GitHub Pages |
| 服务端 | Node.js、Express 4；账号、学习库、生成、计费 API |
| 数据 | Prisma 6、PostgreSQL；账号、收藏、生词本、词典缓存与支付订单 |
| 模型 | OpenAI-compatible API；当前部署配置为 302.ai / DeepSeek V3.2 |
| 文档导出 | 前端 PDF / Word 导出；PDF 使用 html2canvas 与 jsPDF |
| Windows 客户端 | Electron、electron-builder、NSIS |
| 前端重写 | Next.js 16、React 19、TypeScript、Tailwind CSS；开发中 |

```mermaid
flowchart LR
  Web["Web · public/"] --> API["Express API · server.js"]
  Desktop["Windows · Electron"] --> Web
  API --> Gen["文章生成与词典准备"]
  Gen --> Model["OpenAI-compatible 模型服务"]
  API --> ORM["Prisma"]
  Gen --> ORM
  ORM --> DB[(PostgreSQL)]
  API --> Auth["微信身份验证"]
  API --> Pay["FastSpring"]
```

双语和中英混合正文各使用一次生成请求，内容校验失败时最多重生成一次。正文与缺失词典卡并行准备，词典按批生成并持久缓存；整次操作可能包含多个模型请求。详情见 [双语生成](docs/bilingual-generation.md)、[混合生成](docs/mixed-direct-generation.md) 和 [词汇卡准备](docs/vocabulary-details.md)。

<a id="getting-started"></a>

## 本地运行

推荐使用 **Node.js 22+、npm 和 PostgreSQL**。文章生成还需要模型提供商的 API Key。直接使用线上站点无需安装这些工具。

### 1. 获取项目与依赖

```bash
git clone https://github.com/YanYihann/Texta.git
cd Texta
npm ci
```

安装后会自动执行 `prisma generate`。`tools/awesome-design-md` 是可选设计参考子模块，不影响应用运行；需要时执行 `git submodule update --init tools/awesome-design-md`。

### 2. 配置环境

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

macOS / Linux：

```bash
cp .env.example .env
```

在 `.env` 中填写自己的数据库与模型配置，下面使用占位凭据：

```dotenv
DATABASE_URL=postgresql://texta:replace_me@localhost:5432/texta?schema=public
OPENAI_API_KEY=replace_with_your_provider_key
OPENAI_MODEL=deepseek-v3.2
OPENAI_MODEL_NORMAL=deepseek-v3.2
OPENAI_API_MODE=chat
OPENAI_BASE_URL=https://api.302.ai/v1
OPENAI_TIMEOUT_MS=60000
FRONTEND_ORIGIN=http://localhost:3000
PORT=3000
```

`.env.example` 包含其他可选变量。若要创建本地管理员，设置自己的 `ADMIN_EMAIL`、`ADMIN_NAME` 和 `ADMIN_PASSWORD`。微信 AppSecret、支付凭据和模型 Key 仅配置在服务端。

### 3. 连接本地 API

仓库中的 `public/site-config.js` 默认指向线上 API。**本地开发时**将其中的配置改为：

```javascript
window.TEXTA_API_BASE = "";
```

这会让前端请求同源的本地 Express 服务。发布 GitHub Pages 时需要配置线上 API 地址，避免把本地配置直接发布到线上。

### 4. 初始化并启动

先创建一个空的本地 PostgreSQL 数据库，并让 `DATABASE_URL` 指向它，再执行：

```bash
npm run db:push -- --skip-generate
npm start
```

打开 <http://localhost:3000>；健康检查为 <http://localhost:3000/api/health>。服务启动依赖当前数据库结构，包括 `VocabularyDetail` 表。

开发中的 Next.js 前端可单独运行：

```bash
npm ci --prefix frontend-react
npm run dev --prefix frontend-react -- --port 3001
```

该前端仍在迁移中，完整学习流程以 `public/` 为准。

<a id="desktop"></a>

## Windows 桌面版

桌面客户端与网页版共用账号、套餐及已同步的学习库，需要联网使用。它拥有独立登录状态，浏览器未同步的草稿和本地历史不会自动迁移。

在仓库根目录执行：

```bash
npm run desktop:install
npm run desktop:start
npm run test:desktop
npm run desktop:build
```

安装包输出至 `output/desktop/Texta-Setup-1.0.0-x64.exe`。也可手动运行 [Build Windows Desktop](https://github.com/YanYihann/Texta/actions/workflows/build-desktop.yml)，获取安装包及 SHA-256 校验文件。该工作流只上传构建产物，不自动创建 Release。

当前客户端没有自动更新器，安装包尚未配置代码签名；应用更新和分发步骤见 [桌面版文档](docs/desktop.md)。

<details>
  <summary>查看桌面客户端截图</summary>

![Texta Windows 客户端中的登录界面](docs/images/desktop.png)

</details>

<a id="development"></a>

## 验证与开发

从仓库根目录运行：

```bash
npm test
```

该命令覆盖微信账号、账号合并、计费、两种文章生成、词典缓存、网页微信状态、学习库和句子翻译。桌面客户端需要单独安装依赖后验证：

```bash
npm run test:desktop
npm run test:smoke --prefix desktop
```

核心检查使用本地夹具、模拟模型和数据库替身，不调用付费生成 API。真实 PostgreSQL 并发与回滚检查需要专用测试库；计费集成测试在缺少 `BILLING_TEST_DATABASE_URL` 时跳过。更多说明见 [开发与验证](docs/development.md)。

<a id="deployment"></a>

## 部署

| 组件 | 配置与入口 |
| --- | --- |
| 静态前端 | `.github/workflows/deploy-pages.yml` 发布 `public/`；`public/CNAME` 配置自定义域名 |
| API | `render.yaml` 定义 Render 服务；`public/site-config.js` 指定前端使用的 API 地址 |
| 数据库 | PostgreSQL；现有 Render 构建流程执行 Prisma schema 同步 |
| 桌面版 | `.github/workflows/build-desktop.yml` 手动构建 Windows x64 安装包 |

仓库配置的线上入口：[网站](https://texta.yanyihan.top/) · [API 健康检查](https://api-texta.yanyihan.top/api/health)。服务可用性与源码同步相互独立。

数据库升级、跨域配置、密钥与发布步骤见 [部署说明](docs/deployment.md)。

<a id="structure"></a>

## 项目结构

```text
Texta/
├── public/                 # 当前线上网页、样式、字体与导出资源
├── auth/                   # 微信身份、邮箱关联和账号合并
├── billing/                # 套餐、积分、订单和 FastSpring
├── generation/             # 双语、混合故事与完整词汇卡
├── prisma/schema.prisma    # PostgreSQL 数据模型
├── desktop/                # Electron 客户端、图标、构建和测试
├── frontend-react/         # Next.js 前端重写（开发中）
├── tests/                  # 核心回归检查与本地预览夹具
├── experiments/            # 生成实验脚本、数据集、报告与结果
├── docs/                   # 文档索引、截图、配置和历史资料
├── scripts/                # 版本号等项目工具
├── tools/                  # 可选设计参考子模块
├── .github/workflows/      # Pages 发布与桌面构建
├── .env.example            # 环境变量示例
├── server.js               # Express 入口
└── render.yaml             # Render 部署配置
```

文档从 [docs/README.md](docs/README.md) 开始；产品约束见 [PRODUCT.md](PRODUCT.md)，界面规范见 [DESIGN.md](DESIGN.md)。依赖、真实 `.env`、数据库备份、调试日志、模型原始运行轨迹和安装包保留在本地，由 `.gitignore` 排除。

<a id="roadmap"></a>

## 后续方向

以下是基于当前代码状态整理的方向，未承诺发布时间。

- [x] 双语文章与中英混合故事
- [x] 完整词汇卡并行准备与持久缓存
- [x] 收藏、生词本、掌握状态及学习库同步
- [x] 邮箱登录、微信身份关联与账号合并后端
- [x] PDF / Word 导出与 Windows 客户端构建
- [ ] 完成 Next.js 前端迁移
- [ ] 扩充真实 PostgreSQL 环境中的集成验证
- [ ] 完成正式支付启用与真实结算验收
- [ ] 完成桌面版签名、正式下载分发与更新机制

<a id="contributing"></a>

## 参与贡献

欢迎通过 [Issues](https://github.com/YanYihann/Texta/issues) 描述问题或建议。反馈时请附上操作步骤、预期行为和实际结果；涉及界面时可提供截图，注意遮挡个人信息。

提交修改前先建立功能分支，更新受影响的文档，并运行对应检查。生成流程修改应覆盖词汇命中、格式校验、错误恢复和积分退款；学习库修改应检查用户隔离、旧数据兼容和删除状态保留。

项目维护者：[YanYihann](https://github.com/YanYihann)。

<a id="license"></a>

## 许可证与致谢

本仓库目前没有项目级 `LICENSE`，因此没有声明对项目整体的开源授权。字体、词表及第三方代码的许可分别保留在 `public/fonts/` 和 `public/vendor/` 中。

README 采用 [Best-README-Template](https://github.com/othneildrew/Best-README-Template) 的项目介绍、安装、使用、贡献等结构，并参考 [awesome-readme](https://github.com/matiassingers/awesome-readme) 收录案例中的截图、简明导航和功能展示方式。所有功能描述按本仓库实现整理。

<p align="right"><a href="#readme-top">返回顶部</a></p>
