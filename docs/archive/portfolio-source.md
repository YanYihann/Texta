# Texta — Portfolio 项目素材

> 历史整理素材：部分设置（例如难度分级）已由后续实现替换，发布作品集前请按 [当前项目说明](../../README.md) 核对。本文保留原始记录，不代表已核验的最新产品状态。

依据当前主要代码整理，2026-10-06。展示对象为 `public/` 的学习工作区；`frontend-react/` 目前仅有主题切换演示，不作为产品界面。本文未运行应用或核验线上状态。

## 1. Project Overview

**Project name** — Texta

**One-line description** — 将指定英语单词与短语转成双语或中英混合文章，并连接语境查词、生词整理与学习资料导出。

**Problem / Goal** — 为孤立词表补充阅读语境，让学习者能看到词汇如何使用，再把陌生词和文章留作复习材料。

**My role** — Unknown / needs manual input。仓库涵盖前端交互、AI 生成逻辑、后端与数据保存，无法确认哪些部分由你独立完成。

**Type** — AI Tool / Web App / Language Learning Tool

**Main stack** — 原生 JavaScript / HTML / CSS；Node.js；Express；Prisma + PostgreSQL；302.ai 的 OpenAI-compatible API（默认 DeepSeek V3.2）。

**Status** — Working prototype；仓库包含 GitHub Pages 前端与 Render 后端部署配置，当前在线可用性未核验。

**Links** — [Live site（仓库配置）](https://texta.yanyihan.top/) · [GitHub（Git remote）](https://github.com/YanYihann/Texta)

## 2. The Idea

### 为什么会有这个项目？

从现有功能可以确认，项目针对英语词汇学习：输入的是学习者自己的目标词，而输出同时包含文章、释义和复习入口。个人起因、用户研究及实际学习效果：Unknown / needs manual input。

### 核心 idea 是什么？

用目标词汇约束 AI 写作，让词表进入连续语境。双语模式提供英文段落及中文对照；中英混合模式把英语目标词嵌入中文情境，并在词旁展示词性和释义。生成之后，用户继续查词、标记掌握状态、收藏文章和整理生词。

### 最重要的一点是什么？

值得记住的是“词汇 → 语境 → 可回到原文的复习材料”这条闭环：生词本保留来源文章，复习时能够重新查看当时的用法。

## 3. How It Works

### 01 — 准备目标词汇

输入或导入单词与短语，以逗号或回车整理成可编辑词条；查看拼写提示，选择难度与生成模式。

### 02 — 生成学习文章

生成双语文章或中英混合内容。生成完成后，输入区收起，界面进入阅读工作区。

### 03 — 在文章中查词

点击高亮词，查看词义、搭配、原文例句及译文；可隐藏中文、听英美发音，或进入阅读模式。

### 04 — 保存并回顾

收藏文章，把词标记为“陌生”并加入生词本；复习时切换掌握状态、跳转原文，或预览并导出学习材料。

## 4. Key Features & Decisions

### Feature 01 — 两种词汇语境生成方式

**What it does** — 支持英文文章配中文对照，以及中文情境嵌入英语目标词；可选择难度和短文章模式。

**Why it matters** — 提供整篇英语阅读与中文辅助记忆两种使用方式。切换模式影响下一次生成，需要重新生成内容。

**How it works** — 后端先准备词汇信息，再生成文章；双语模式继续生成段落译文与词义对齐，混合模式输出带语境释义的文本片段。对目标词覆盖进行检查和修复。

**Relevant files** — `server.js`；`public/app.js`；`public/vocabulary.js`

### Feature 02 — 保留短语的词汇编辑器

**What it does** — 将词汇整理成可逐个编辑、删除的词条；支持文件导入、拼写字母标记与 Tab 补全，保留短语内部空格。

**Why it matters** — 用户能够控制 AI 的输入材料；词汇编辑与文章阅读分开呈现，阅读时为正文腾出空间。

**How it works** — 本地词典提供补全与保守的拼写建议；输入按分隔符拆分并去重，导入内容合并到现有词表。输入和生成设置按账户保存本地草稿。

**Relevant files** — `public/vocabulary.js`；`public/word-assist.js`；`public/workspace.js`

### Feature 03 — 文章与单词解析联动

**What it does** — 点击英文目标词或中文对应高亮，切换右侧单词解析；展示词义、搭配、“在本文中”的例句与译文，扩展信息按需展开。

**Why it matters** — 查词保留当前阅读语境。阅读模式收起工具区，仍可点击词汇临时打开解析浮层。

**How it works** — 用词汇 key 关联高亮与解析卡片，双语模式使用词义对齐信息。词汇详情不足时补充请求；可见例句的翻译按需加载并缓存。

**Relevant files** — `public/app.js`；`public/workspace.js`；`server.js`

### Feature 04 — 带来源的生词复习

**What it does** — 管理陌生词与已掌握词，提供列表、卡片和按首次加入日期查看的日历；“跳转原文”重新打开文章并定位目标词。

**Why it matters** — 复习词条保留最初的学习情境。日历表示加入日期，不是复习计划或学习打卡。

**How it works** — 保存生词时附带文章快照；收藏、生词、掌握状态和文件夹通过本地存储与账户云端同步，失败时保留本地修改并重试。

**Relevant files** — `public/library.js`；`public/app.js`；`prisma/schema.prisma`

## 5. Technical Notes & Limitations

### Worth mentioning

- **AI 结果转为可交互材料**：文章、词汇、段落译文、对齐信息及混合文本片段分别处理，支持查词和保存。使用提示词要求 JSON，并自行解析、规范化与兜底；不是 API 层严格 schema 保证。
- **保护目标词汇**：混合生成使用 `⟦T1⟧` 等占位符，生成后还原英文词；检查遗漏和非目标英文，必要时重写或补充。它直接服务于“指定词必须进入语境”的产品要求。
- **保存学习语境**：生词附带原文快照；云端合并使用更新时间和删除标记。本地历史记录另行保存，最多保留 80 条，不包含在云端同步快照中。

### Current limitations

- 词义、译文与混合语句依赖模型输出；代码存在翻译失败、词义待补充及补句兜底，不能保证全部内容自然、准确。
- 生成依赖登录、积分、数据库和外部 AI 服务；多阶段处理完成后一次返回，没有逐字流式显示。
- PDF 将内容栅格化为单张长页，正文不是可选中文本；Word 导出为 HTML 包装的 `.doc`，不是原生 `.docx`。
- `frontend-react/` 尚未实现完整学习流程，不能作为已完成的 React 产品介绍。

## 6. Screenshot List

**统一准备** — 使用一个可登录且有生成积分的演示账户；关闭使用说明弹窗。桌面建议 1440 × 1000、100% 缩放、默认浅色主题。主要界面都在 `/app.html`，收藏夹和生词本是页内切换，没有独立路由。

**统一示例词表** — `sustainable, resilient, adapt, perspective, thrive, balance, reduce waste, public transport`。这组词适合可持续生活或社区议题；产品没有独立主题输入，生成标题和故事以实际输出为准。内置的 “A greener way to live” 可用于演示阅读，但应保留“示例文章”标记，不能当作本次 AI 生成结果。

### Screenshot 01 — 双语阅读工作区（首图）

**Page / Route** — `/app.html` → 文章阅读

**What to show** — 文章标题、前 1–2 段英文及中文对照、目标词高亮，以及右侧一个完整可读的单词解析上半部。

**How to prepare**

1. 输入统一词表，选择“中级”“双语文章”，点击生成。
2. 等待完成并确认中文显示，点击正文中可见的 `sustainable` 或 `resilient`。
3. 正文滚到标题，解析滚到顶部；保留顶部学习导航，关闭导出菜单。

**Recommended content** — 绿色生活或社区适应变化的文章；无缺词警告、翻译失败占位。

**Why this screenshot matters** — 一张图说明产品最终提供的是可查词的双语学习文章。

### Screenshot 02 — 准备可控的词汇输入

**Page / Route** — `/app.html` → 文章生成；已有结果时点击“修改词汇”

**What to show** — 6–8 个词条、含空格的短语、词数、难度、两种模式与生成按钮；输入框中的补全提示。

**How to prepare**

1. 输入统一词表中的其他 7 项，以逗号或回车提交成词条。
2. 最后输入 `sust`，保持焦点并等待本地词典加载与 Tab 提示出现，暂不接受补全。
3. 保持“更多设置”关闭，截取输入面板；截图后接受补全再生成。

**Recommended content** — 使用 `reduce waste`、`public transport` 展示短语保留，避免开发测试文本。

**Why this screenshot matters** — 展示用户如何准备和调整 AI 输入，而不是只看到一个生成按钮。

**Better as video / GIF** — 录制“输入 `sust` → Tab 补全 → 回车成词条 → 点击词条修改”的 8–12 秒操作。

### Screenshot 03 — 中英混合生成结果

**Page / Route** — `/app.html` → 文章阅读（中英混合结果）

**What to show** — 中文情境中的英文高亮词、紧邻的词性和中文释义，以及对应解析。

**How to prepare**

1. 收藏 Screenshot 01 的文章，再点击“修改词汇”。
2. 保留统一词表，切换“中英混合”并重新生成。
3. 等待完成，选择正文可见的目标词；保留能读懂的小段情境。

**Recommended content** — 同一组环境主题词汇，便于与双语结果比较；挑选语句连贯、释义完整的真实输出。

**Why this screenshot matters** — 展示项目区别于普通英文文章生成器的另一种学习方式。

### Screenshot 04 — 从高亮词到本文例句

**Page / Route** — `/app.html` → 双语文章 → 词汇解析

**What to show** — 左侧目标词所在句子，右侧同词的“在本文中”原文例句和译文；两边的目标词保持可见。

**How to prepare**

1. 从收藏夹重新打开 Screenshot 01 的双语文章，点击 `resilient`。
2. 将正文滚到它所在段落，单独滚动右侧解析到“在本文中”。
3. 等待例句翻译和详情加载完成，裁切保留左右关联内容。

**Recommended content** — 如实际生成了 `a resilient community`，使用该句；以文章真实句子为准。

**Why this screenshot matters** — 证明查词展示的是当前文章中的具体用法。

**Better as video / GIF** — 录制“点击两个不同高亮词 → 解析切换”；也可录制“进入阅读模式 → 点击词汇打开浮层 → 关闭返回阅读”。

### Screenshot 05 — 生词本与来源文章

**Page / Route** — `/app.html` → 生词本 → 列表

**What to show** — 3–5 个生词、掌握状态分类，以及一个展开词条中的“跳转原文”和来源标题。

**How to prepare**

1. 在文章解析中将 4–5 个词标记为“陌生”，点击“将陌生词添加到生词本”。
2. 打开生词本，将其中一个词标记“已掌握”，再回到“生词”分类。
3. 使用列表视图，展开 `resilient` 的详情，确认来源标题和跳转按钮可见。

**Recommended content** — 来自前面真实文章的词条，保留 3–4 个陌生词和至少 1 个已掌握词。

**Why this screenshot matters** — 展示生成结果如何成为保留语境的个人复习材料。

**Better as video / GIF** — 点击“跳转原文”，录制文章打开、滚动定位与对应解析出现的过程。

### Screenshot 06 — 手机上的阅读与查词

**Page / Route** — `/app.html` → 手机文章视图

**What to show** — 竖屏文章、可读的目标词高亮，以及底部“输入 / 文章 / 词汇”导航。

**How to prepare**

1. 在手机或手动浏览器设备模式下使用约 390 × 844 的视口，登录同一账户。
2. 从收藏夹打开 Screenshot 01 的文章，切到“文章”。
3. 将含目标词的段落移入视口，保持底部导航可见；正常阅读模式下截图。

**Recommended content** — 使用前面收藏的同一篇文章，体现同一材料在不同屏幕上的呈现。

**Why this screenshot matters** — 展示窄屏如何把桌面的文章与解析拆为可切换视图。

**Better as video / GIF** — 点击文章高亮词进入词汇解析，再通过底部导航回到文章，录制 6–10 秒。

### Screenshot 07 — 可配置的学习资料导出

**Page / Route** — `/app.html` → 文章阅读 → 导出 → 导出前预览

**What to show** — 预览弹窗、标题输入、中文翻译开关、页边距和已排版的正文；页面向下还有词汇表。

**How to prepare**

1. 打开收藏的双语文章，展开“导出”，点击“导出 PDF”。
2. 将标题改为 `Sustainable Living — Vocabulary Review`，勾选中文翻译，选择标准页边距。
3. 保持预览停在正文顶部，等待版面稳定；截图无需点击确认下载。

**Recommended content** — 同一篇文章的完整学习材料，不只放几个单词或空预览。

**Why this screenshot matters** — 展示用户能在保存到外部资料前调整标题、翻译与版面。
