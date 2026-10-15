<a id="readme-top"></a>

<div align="center">
  <a href="https://texta.yanyihan.top/"><img src="public/logo.svg" alt="Texta" width="168" /></a>
  <h1>Texta · 串词记</h1>
  <p><strong>把单词放进文章，在语境中记住它们。</strong></p>
  <p>输入词表 → 生成文章 → 对照阅读 → 收藏复习 → 导出学习材料</p>
  <p>
    <a href="https://texta.yanyihan.top/">网页版</a> ·
    <a href="wechat-miniprogram/README.md">微信小程序</a> ·
    <a href="docs/desktop.md">Windows 桌面版</a> ·
    <a href="docs/README.md">开发文档</a> ·
    <a href="https://github.com/YanYihann/Texta/issues">问题反馈</a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/YanYihann/Texta/actions/workflows/test.yml"><img src="https://github.com/YanYihann/Texta/actions/workflows/test.yml/badge.svg" alt="Core tests" /></a>
  <a href="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml"><img src="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml/badge.svg" alt="Web deployment" /></a>
  <a href="frontend-react/package.json"><img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js 16" /></a>
  <a href="wechat-miniprogram/project.config.json"><img src="https://img.shields.io/badge/WeChat-原生小程序-07C160?logo=wechat&logoColor=white" alt="Native WeChat mini program" /></a>
</p>

<details>
  <summary>目录</summary>
  <ol>
    <li><a href="#about">项目介绍与使用入口</a></li>
    <li><a href="#preview">界面预览</a></li>
    <li><a href="#features">多端功能对照</a></li>
    <li><a href="#usage">使用流程</a></li>
    <li><a href="#sync">账号与数据同步</a></li>
    <li><a href="#architecture">技术架构</a></li>
    <li><a href="#getting-started">本地运行网页版与后端</a></li>
    <li><a href="#mini-program">开发微信小程序</a></li>
    <li><a href="#desktop">运行 Windows 桌面版</a></li>
    <li><a href="#development">检查与测试</a></li>
    <li><a href="#deployment">部署与发布</a></li>
    <li><a href="#structure">项目结构与文档</a></li>
    <li><a href="#roadmap">开发方向</a></li>
    <li><a href="#contributing">贡献与联系</a></li>
    <li><a href="#license">许可证与致谢</a></li>
  </ol>
</details>

<a id="about"></a>

## 项目介绍与使用入口

Texta 是面向英语词汇学习者的多端学习工具，适用于雅思备考和日常积累。输入单词或短语，生成包含目标词的双语文章或中英混合故事，在阅读中理解词义、搭配和原文用法，再通过生词本和导出材料复习。

本仓库统一维护 **Next.js 网页版、原生微信小程序、Windows 桌面客户端及共用后端**。

| 入口 | 使用方式 | 源码与说明 |
| --- | --- | --- |
| 网页版 | 打开 **[texta.yanyihan.top](https://texta.yanyihan.top/)**，支持电脑和手机浏览器 | [frontend-react/](frontend-react/) · [网页开发文档](docs/next-frontend.md) |
| 微信小程序 | 微信内搜索 **「Texta串词记」**；本地预览见下方开发步骤 | [wechat-miniprogram/](wechat-miniprogram/) · [小程序说明](wechat-miniprogram/README.md) |
| Windows 桌面版 | 安装客户端，或从源码启动；联网加载同一网站 | [desktop/](desktop/) · [桌面版文档](docs/desktop.md) |
| 共用 API | 为各端提供认证、生成、词典、学习库和套餐数据 | [server.js](server.js) · [部署说明](docs/deployment.md) |

小程序源码版本为 `1.1.2`。原项目的 2026-10-07 记录表明 `1.0.0` 已发布、`1.1.2` 已上传待审核；该历史记录不代表当前公众平台的审核状态，GitHub 同步也不会自动发布微信正式版。

<a id="preview"></a>

## 界面预览

### 网页阅读工作区

![Texta 网页双语阅读与词汇解析](docs/images/reading.png)

*网页版界面示例，展示英文阅读、中文对照和词汇卡；截图为已有界面记录，最新页面以线上版本为准。*

### 微信小程序

<p align="center">
  <img src="docs/images/mini-input.png" alt="小程序词汇输入与拼写辅助" width="240" />
  <img src="docs/images/mini-reading.png" alt="小程序中英对照阅读" width="240" />
  <img src="docs/images/mini-export.png" alt="小程序文档导出设置与预览" width="240" />
</p>

*原生小程序模拟器截图：词汇输入、对照阅读、导出预览；使用测试文章展示。*

<a id="features"></a>

## 多端功能对照

| 能力 | 网页版 / Windows 客户端 | 微信小程序 |
| --- | --- | --- |
| 词汇输入 | 单词与短语标签、拼写建议、补全、TXT / Markdown / CSV / JSON 导入 | 标签编辑、拼写建议、补全、剪贴板与相同格式导入 |
| 文章生成 | 双语文章、中英混合故事、短文模式 | 中英对照、中文嵌词、短文模式 |
| 阅读与词义 | 英中高亮、语境义项、英美音标、发音、搭配、构词、近反义词 | 对应高亮、原生词义抽屉、语境义项、音标、搭配、构词、近反义词 |
| 阅读设置 | 六套主题、字号、中英文界面、隐藏中文、阅读模式、手机布局 | 六套主题、字号、中英对照 / 英文 / 词汇表视图；中文界面 |
| 收藏与复习 | 收藏文章、文件夹、生词本、掌握状态、来源文章 | 收藏、生词本、掌握状态、搜索、来源文章、由生词生成复习短文；保留云端文件夹资料 |
| 历史与草稿 | 按账号保存本机草稿和最近 80 篇历史；历史默认最新加入在前 | 按账号保存本机草稿和最近 30 篇历史 |
| 账号 | 邮箱注册与登录、微信绑定状态查看 | 微信快捷登录、邮箱注册 / 登录、绑定新邮箱、验证原密码关联已有账号 |
| 学习库同步 | 收藏、生词、掌握状态和文件夹通过 API 同步 | 使用相同学习库 API，保留离线修改与删除标记 |
| 学习材料导出 | PDF、Word `.doc`；预览、标题、中文译文和页边距设置 | PDF、可编辑 Word `.docx`、TXT 和文章复制；导出设置与预览 |
| 套餐与管理 | 套餐目录、订单流程、管理员用量及历史审核页面 | 当前套餐、今日额度、后端连接检查；没有内购、微信支付或管理员控制台 |

**文章 PDF / Word 导出附带三列词汇表：英文、词性、中文翻译。** 网页版关闭正文译文时仍保留词汇表释义；正文词义序号以小号上标显示，导出同步保留。网页生成或打开文章后隐藏阅读区底部的政策与版权页脚。

小程序 PDF 使用本机画布生成，为图片型 PDF；DOCX 为可编辑的 OOXML 文档。网页版 Word 使用 HTML `.doc` 格式，两端文件实现有区别。

套餐包含 Free / Plus / Pro、月度与永久权益。购买是否开放以服务端返回和支付配置为准；FastSpring 测试订单不会授予正式权益。详见 [支付接入](FASTSPRING_SETUP.md)。

<a id="usage"></a>

## 使用流程

1. 网页版注册或登录；小程序可用微信快捷登录，首次创建免费账号。
2. 粘贴或导入需要学习的词汇，检查词条和拼写。
3. 选择双语文章或中英混合故事，可按需开启短文模式。
4. 阅读生成文章，点击高亮词查看语境词义及词汇卡。
5. 收藏文章、添加生词并标记掌握状态；换设备前同步需要保留的资料。
6. 预览并导出学习材料，在正文后查看词汇表。

可直接复制这组词测试输入：

```text
sustainable, resilient, adapt, perspective, thrive, balance, curious,
journey, challenge, opportunity, achieve, discover, essential, improve, confidence
```

生成内容由模型提供，词义与用法应结合原文核对。生成失败会尝试退回预留积分；成功准备的通用词典卡可继续复用。

<a id="sync"></a>

## 账号与数据同步

网页版、桌面版和小程序连接相同 Express API。**使用同一账号，才能访问同一份云端学习资料。** 微信首次登录创建的账号不会仅凭填写邮箱就自动变成原有网页账号。

已有网页账号时，在小程序进入 **「我的 → 账号设置 → 关联已有账号」**，输入原邮箱和原密码，经验证后合并符合条件的微信账号资料，并保留目标邮箱账号的套餐。已有订单或付费权益、微信绑定冲突及资料超限等情况会阻止自动合并。详见 [账号关联与合并](docs/wechat-login.md)。

| 数据 | 保存位置与跨端行为 |
| --- | --- |
| 账号、套餐、额度 | 服务端保存；登录同一账号后共用 |
| 收藏、生词、掌握状态、文件夹 | 云端学习库与各端缓存；同步后跨设备读取，具体编辑界面因客户端而异 |
| 生成历史、输入草稿 | 当前浏览器或小程序本机保存；不自动跨设备同步 |
| 主题、语言、字号 | 各客户端本地偏好；不同端分别设置 |
| 词汇卡 | 随文章保存，通用词典卡由服务端缓存复用 |

各端上传学习库前先读取合并，网络失败保留本地修改。当前快照同步接口仍存在多设备同时修改的竞争窗口；本机历史中需要长期保存的文章建议加入收藏。桌面客户端拥有独立浏览器存储，不会自动读取普通浏览器未同步的内容。

<a id="architecture"></a>

## 技术架构

| 部分 | 实现 |
| --- | --- |
| 网页前端 | Next.js 16、React 19、TypeScript；静态导出至 GitHub Pages |
| 微信小程序 | 原生 JavaScript、WXML、WXSS；运行代码无 npm 依赖 |
| Windows 客户端 | Electron、electron-builder、NSIS；加载线上站点 |
| 共用后端 | Node.js、Express 4；认证、学习库、生成、用量、支付 API |
| 数据 | Prisma 6、PostgreSQL；账号、资料、词典缓存、用量和订单 |
| 生成服务 | OpenAI-compatible API；仓库 Render 配置为 302.ai / DeepSeek V3.2 |
| 文档导出 | 网页 html2canvas / jsPDF / HTML Word；小程序 canvas PDF / OOXML DOCX |

```mermaid
flowchart LR
  Browser["电脑 / 手机浏览器"] --> Web["Next.js · GitHub Pages"]
  Desktop["Windows · Electron"] --> Web
  Web --> API["Express API"]
  Mini["原生微信小程序"] --> API
  API --> Generation["文章生成 + 词汇卡准备"]
  Generation --> Model["OpenAI-compatible 模型服务"]
  API --> Prisma["Prisma"]
  Generation --> Prisma
  Prisma --> DB[(PostgreSQL)]
  API --> WeChat["微信身份验证"]
  API --> Payment["FastSpring"]
```

正文和缺失词汇卡并行准备，词典按批生成并持久缓存。双语 / 混合正文校验失败时最多重生成一次，整次操作可能包含多个模型请求。详见 [双语生成](docs/bilingual-generation.md)、[混合生成](docs/mixed-direct-generation.md) 和 [词汇卡](docs/vocabulary-details.md)。

<a id="getting-started"></a>

## 本地运行网页版与后端

需要 **Node.js 22+、npm、PostgreSQL** 和模型提供商的 API Key。使用线上网站无需安装开发环境。

### 1. 安装依赖

```bash
git clone https://github.com/YanYihann/Texta.git
cd Texta
npm ci
npm ci --prefix frontend-react
```

根目录安装会执行 `prisma generate`。可选设计参考子模块 `tools/awesome-design-md` 不影响应用运行，无需递归克隆。

### 2. 创建本地配置

Windows PowerShell：

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react/.env.local.example frontend-react/.env.local
```

macOS / Linux：

```bash
cp .env.example .env
cp frontend-react/.env.local.example frontend-react/.env.local
```

在根目录 `.env` 填写自己的配置，例如：

```dotenv
DATABASE_URL=postgresql://texta:replace_me@localhost:5432/texta?schema=public
OPENAI_API_KEY=replace_with_your_provider_key
OPENAI_BASE_URL=https://api.302.ai/v1
OPENAI_MODEL=deepseek-v3.2
OPENAI_MODEL_NORMAL=deepseek-v3.2
OPENAI_API_MODE=chat
OPENAI_TIMEOUT_MS=60000
FRONTEND_ORIGIN=http://localhost:3001
PORT=3000
```

前端 `frontend-react/.env.local`：

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

`.env.example` 包含管理员、会话和微信的可选变量。模型 Key、数据库密码、管理员密码、小程序 AppSecret 和支付凭据仅放在服务端；`NEXT_PUBLIC_*` 中只填写公开配置。

### 3. 初始化数据库并启动

先创建空的本地数据库，确认 `DATABASE_URL` 指向它：

```bash
npm run db:push -- --skip-generate
npm start
```

另开终端运行前端：

```bash
npm run dev --prefix frontend-react
```

网页入口：[localhost:3001](http://localhost:3001)；API 健康检查：[localhost:3000/api/health](http://localhost:3000/api/health)。现有数据库升级流程见 [部署说明](docs/deployment.md)。

正式静态构建预览：

```bash
npm run build --prefix frontend-react
npm start --prefix frontend-react
```

预览地址为 [127.0.0.1:4173](http://127.0.0.1:4173)，连接本地 API 时需在后端允许该来源。静态导出使用仓库预览服务器启动，详细路由及旧数据兼容见 [Next.js 前端](docs/next-frontend.md)。

<a id="mini-program"></a>

## 开发微信小程序

1. 在微信开发者工具中导入仓库的 **`wechat-miniprogram/`** 目录。
2. 项目配置保留现有 AppID；维护者使用原项目权限，其他开发者需使用自己的 AppID 配置后端微信凭据。
3. 点击编译；运行页面无需“构建 npm”。`miniprogram/config.js` 只包含公共 API 地址等公开设置。
4. 真机请求需要在公众平台配置 API 的 request 合法域名；使用本地 API 时修改公共地址，并根据开发环境设置网络校验。
5. 微信登录要求后端的 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 与所用小程序一致。

从仓库根目录检查小程序：

```bash
npm run mini:check
npm run test:mini
```

模拟器自动化需要额外安装开发依赖：

```bash
npm ci --prefix wechat-miniprogram
npm run mini:compile
```

`mini:compile` 使用本机微信开发者工具编译器，安装位置可用 `WECHAT_COMPILER_ROOT` 指定。原生页面清单、API 配置、文件导出、模拟器检查和发布流程见 **[小程序 README](wechat-miniprogram/README.md)**。

<a id="desktop"></a>

## 运行 Windows 桌面版

```bash
npm run desktop:install
npm run desktop:start
npm run test:desktop
npm run desktop:build
```

安装包输出至 `output/desktop/Texta-Setup-1.0.0-x64.exe`。也可手动运行 [Build Windows Desktop](https://github.com/YanYihann/Texta/actions/workflows/build-desktop.yml) 获取构建产物及 SHA-256 校验文件。客户端需要联网，当前未配置代码签名与自动更新，工作流不会自动创建 Release。详见 [桌面版文档](docs/desktop.md)。

<details>
  <summary>桌面客户端界面</summary>

![Texta Windows 客户端](docs/images/desktop.png)

</details>

<a id="development"></a>

## 检查与测试

从仓库根目录执行：

```bash
npm test
npm run lint --prefix frontend-react
npm test --prefix frontend-react
npm run build --prefix frontend-react
npm run mini:check
npm run test:mini
```

| 范围 | 验证内容 |
| --- | --- |
| 后端 | 微信身份、账号合并、用量计费、双语 / 混合生成、词典缓存、学习库、句子翻译 |
| 网页 | 旧缓存兼容、账号隔离、同步失败保护、请求期间编辑、双语对齐、导出内容与转义；构建检查 TypeScript 与静态路由 |
| 小程序 | JS / JSON、页面、事件与图标；输入、阅读、导出布局、会话、账号关联、资料合并及同步竞态 |
| 微信本机编译 | `npm run mini:compile` 检查 WXML / WXSS；需要安装微信开发者工具 |
| 桌面 | 安装桌面依赖后执行 `npm run test:desktop`；详见桌面文档 |

GitHub 的 **Core tests** 工作流包含后端、网页及小程序检查。核心单元检查使用本地夹具，不调用付费生成 API；真实数据库并发、支付结算和物理手机验收需分别执行，跳过的数据库测试不能视为已通过。详见 [开发与验证](docs/development.md)。

<a id="deployment"></a>

## 部署与发布

| 组件 | 配置与发布方式 |
| --- | --- |
| 网页版 | [deploy-pages.yml](.github/workflows/deploy-pages.yml) 构建 `frontend-react/out/` 并部署 GitHub Pages；保留 CNAME 和旧 `.html` 链接跳转 |
| Express API | [render.yaml](render.yaml) 定义 Render 服务；密钥使用服务端环境变量 |
| PostgreSQL | [prisma/schema.prisma](prisma/schema.prisma) 定义结构；升级前备份并验证 schema 变化 |
| 微信小程序 | 微信开发者工具预览 / 上传，公众平台审核与发布；独立于 GitHub Pages |
| Windows | [build-desktop.yml](.github/workflows/build-desktop.yml) 手动构建，正式分发单独处理 |

线上入口：[网页版](https://texta.yanyihan.top/) · [API 健康检查](https://api-texta.yanyihan.top/api/health)。完整配置见 [部署文档](docs/deployment.md)、[微信认证](docs/wechat-login.md) 和 [FastSpring](FASTSPRING_SETUP.md)。

<a id="structure"></a>

## 项目结构与文档

```text
Texta/
├── frontend-react/         # Next.js 网页前端、路由、阅读与导出
├── wechat-miniprogram/     # 原生微信小程序、资源、测试与发布记录
│   ├── miniprogram/        # 页面、组件、数据、API 与导出工具
│   ├── scripts/            # 检查、编译和模拟器验收
│   ├── tests/              # 小程序功能回归
│   └── project.config.json # 开发者工具导入入口
├── desktop/                # Electron 客户端、构建和测试
├── auth/                   # 微信身份、邮箱关联和账号合并
├── billing/                # 套餐、积分、订单与 FastSpring
├── generation/             # 双语、混合故事与完整词汇卡
├── prisma/                 # 数据库模型
├── public/                 # 共享资源、字体、词表、政策与旧网页回退
├── docs/                   # 开发、部署、功能说明和多端截图
├── tests/                  # 后端回归及本地预览夹具
├── experiments/            # 生成实验源码、数据集与总结
├── scripts/                # 项目工具
├── tools/                  # 可选设计参考子模块
├── .github/workflows/      # 自动检查、网页发布和桌面构建
├── .env.example            # 服务端配置示例
├── server.js               # 共用 Express API 入口
└── render.yaml             # Render 部署配置
```

文档入口：**[项目文档索引](docs/README.md)** · [网页前端](docs/next-frontend.md) · [小程序](wechat-miniprogram/README.md) · [桌面版](docs/desktop.md) · [生成实验](experiments/README.md)。各端产品与界面约束保留在对应 `PRODUCT.md` / `DESIGN.md`。

仓库包含可运行源码、锁文件、静态资源、测试和开发文档。本地 `.env`、用户数据、数据库备份、开发者工具私有配置、历史备份、依赖目录、调试日志及构建产物由 `.gitignore` 排除；原本地文件保留。

<a id="roadmap"></a>

## 开发方向

- [x] 双语文章、中英混合故事、词汇卡与持久缓存
- [x] Next.js 网页版与 Windows 客户端
- [x] 原生微信小程序与微信登录、邮箱账号关联
- [x] 学习库同步、生词复习及带词汇表的文档导出
- [x] 网页、小程序、后端源码与检查入口统一到本仓库
- [ ] 扩充真实 PostgreSQL 并发与回滚集成验证
- [ ] 增强多设备同时编辑的同步冲突控制
- [ ] 完成正式支付启用及结算验收
- [ ] 完善桌面签名、下载分发和自动更新

以上为开发方向，未承诺交付时间；小程序审核发布进度以公众平台为准。

<a id="contributing"></a>

## 贡献与联系

欢迎通过 [Issues](https://github.com/YanYihann/Texta/issues) 提交操作步骤、预期行为和实际结果。修改应更新对应端文档并运行相关检查；涉及生成、认证或学习库时，注意词汇校验、错误退款、账号隔离和旧资料兼容。

维护者：[YanYihann](https://github.com/YanYihann) · 联系邮箱：[1963372275@qq.com](mailto:1963372275@qq.com)。

<a id="license"></a>

## 许可证与致谢

仓库目前未提供项目级 `LICENSE`，未对项目整体声明开源许可。字体、词表及第三方代码保留各自许可文件，见 `public/fonts/`、`public/vendor/` 和 `wechat-miniprogram/miniprogram/data/`。

README 以 [Best-README-Template](https://github.com/othneildrew/Best-README-Template) 的项目介绍、安装、使用、贡献结构为基础，参考 [awesome-readme](https://github.com/matiassingers/awesome-readme) 的截图展示、清晰导航与架构说明，按 Texta 多端项目的实际实现重新编写。

<p align="right"><a href="#readme-top">返回顶部</a></p>
