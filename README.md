# IELTS 单词文章生成网站

输入你今天学的单词，AI 自动生成一篇英文文章，支持高亮词汇、中文释义和一键导出。

## 功能

- 输入单词后生成包含全部词汇的 IELTS 风格文章
- 文章中的输入词自动高亮
- 自动生成每个词的中文释义
- 一键导出 PDF / Word
- 后端会检查文章是否包含全部单词；若缺词会自动重试一次
- 支持 OpenAI 兼容代理（Responses / Chat Completions）`n- 支持快速省钱模式（短文 + 限制token + 跳过补写重试）

## 1) 安装依赖

```bash
npm.cmd install
```

## 2) 配置环境变量

复制 `.env.example` 为 `.env`，并填入你的 Key：

```bash
copy .env.example .env
```

推荐代理配置（按你提供的平台文档）：

```env
OPENAI_API_KEY=你的Key
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_MODE=responses
OPENAI_BASE_URL=https://api.openai-proxy.org/v1
OPENAI_TIMEOUT_MS=30000
OPENAI_RETRY_COUNT=2
PORT=3000
```

说明：
- `OPENAI_BASE_URL` 必须包含 `/v1`。
- `OPENAI_API_MODE=responses` 使用 `/responses`。
- `OPENAI_API_MODE=chat` 使用 `/chat/completions`。

## 3) 启动项目

```bash
npm.cmd start
```

浏览器打开：

[http://localhost:3000](http://localhost:3000)

## 网络超时排查

- 如果报 `Connect Timeout`：
  - 增大 `OPENAI_TIMEOUT_MS`（例如 `60000`）
  - 检查本机是否可访问代理域名 `443`
  - 检查代理平台 key 和模型名是否可用
