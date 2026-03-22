# Texta

Texta is an IELTS vocabulary learning website. You enter the words you studied today, and Texta generates an English article that includes them, with Chinese support and export features.

Texta 是一个 IELTS 单词学习网站。你输入当天学习的单词后，Texta 会生成包含这些词汇的英文文章，并提供中文辅助与导出功能。

## Website URLs | 网站地址

- Frontend (GitHub Pages) | 前端网站：
  - https://yanyihann.github.io/Texta/
- Backend API (Render) | 后端接口：
  - https://texta-backend.onrender.com

## Features | 功能简介

- Generate article by level: Beginner / Intermediate / Advanced  
  按难度生成文章：初级 / 中级 / 高级
- Paragraph-based Chinese translation under each English paragraph  
  每段英文下方显示中文翻译
- Vocabulary highlighting and click-to-jump glossary linkage  
  词汇高亮，点击可跳转右侧词条
- Glossary panel includes: POS, numbered senses, collocations, word formation, synonyms/antonyms  
  词汇栏包含：词性、编号义项、短语搭配、词根词缀、同近义词/反义词
- Pronunciation buttons: American / British  
  发音按钮：美音 / 英音
- Input-time spell suggestions (misspelled words highlighted in red)  
  输入时拼写建议（疑似拼错自动标红）
- Export with preview: PDF / Word  
  导出预览后可下载 PDF / Word
- Reading mode: hide input panel, focus on article + glossary  
  阅读模式：隐藏输入栏，仅看文章与词汇栏

## Workflow | 工作流程

1. User enters words and selects level.  
   用户输入单词并选择难度。
2. Frontend calls `/api/spellcheck` for live typo hints.  
   前端调用 `/api/spellcheck` 实时提示拼写问题。
3. User clicks Generate, frontend sends request to `/api/generate`.  
   点击生成后，前端请求 `/api/generate`。
4. Backend generates: lexicon package + marked English article + Chinese paragraph translations.  
   后端生成：词汇扩展数据 + 带标号英文文章 + 中文分段翻译。
5. Frontend renders middle article panel and right glossary panel.  
   前端渲染中间文章栏和右侧词汇栏。
6. User can click highlighted words to jump glossary, listen pronunciation, and export files.  
   用户可点击高亮词跳转词条、播放发音、导出文件。

## Tech Stack | 技术栈

- Frontend: HTML/CSS/Vanilla JavaScript  
  前端：HTML/CSS/原生 JavaScript
- Backend: Node.js + Express  
  后端：Node.js + Express
- AI: OpenAI-compatible API  
  AI：OpenAI 兼容接口
- Deployment: GitHub Pages (frontend) + Render (backend)  
  部署：GitHub Pages（前端）+ Render（后端）

## Project Structure | 项目结构

- `public/`: frontend files (UI, scripts, assets)  
  `public/`：前端页面、脚本与资源
- `server.js`: backend API server  
  `server.js`：后端 API 服务
- `.github/workflows/deploy-pages.yml`: auto deploy for GitHub Pages  
  `.github/workflows/deploy-pages.yml`：GitHub Pages 自动发布
- `render.yaml`: backend deployment config for Render  
  `render.yaml`：Render 后端部署配置

## Local Run | 本地运行

```bash
npm install
npm start
```

- Local URL | 本地地址：http://localhost:3000

## Production Config | 线上配置

GitHub Pages serves only static frontend. Backend URL is configured in `public/site-config.js`:

GitHub Pages 只托管静态前端。后端地址在 `public/site-config.js` 中配置：

```js
window.TEXTA_API_BASE = "https://texta-backend.onrender.com";
```
