<a id="readme-top"></a>

<div align="center">
  <a href="https://github.com/YanYihann/Texta">
    <img src="public/logo.svg" alt="Texta logo" width="168" />
  </a>

  # Texta

  **Turn IELTS vocabulary lists into bilingual, study-ready reading material.**

  输入目标词汇，生成英文文章、中文对照、词义标记与可复习词汇表。

  [Live Demo](https://texta.yanyihan.top/) · [API Health](https://api-texta.yanyihan.top/api/health) · [Report Bug](https://github.com/YanYihann/Texta/issues/new?labels=bug) · [Request Feature](https://github.com/YanYihann/Texta/issues/new?labels=enhancement)

  [![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Last commit](https://img.shields.io/github/last-commit/YanYihann/Texta)](https://github.com/YanYihann/Texta/commits/main)
</div>

## Overview

Texta is a full-stack IELTS vocabulary writing assistant. Instead of asking learners to memorize isolated words, it turns a target list into a connected English article, aligned Chinese translation, highlighted usage, and a detailed glossary. Users can then save useful results, move unfamiliar words into a notebook, track mastery, and export material for later review.

The current production frontend lives in `public/` and is deployed through GitHub Pages. The Express API runs separately with Prisma and PostgreSQL. `frontend-react/` contains an in-progress Next.js interface rewrite.

## Highlights

| Area | What Texta provides |
| --- | --- |
| Generation | Vocabulary-aware English content with aligned Chinese output |
| Word learning | Part of speech, senses, collocations, synonyms, antonyms, and word formation |
| Review loop | Favorites, notebook entries, mastery preferences, and saved content |
| Quality control | Spellcheck before generation and highlighted word-to-meaning mapping |
| Workspace | Chinese by default, persistent English switch, input drafts, and mobile reading tabs |
| Accounts | Registration, login, sessions, and profile lookup |
| Plans | Daily quotas, free/VIP/admin tiers, and VIP approval workflow |
| Export | PDF and Word export from the frontend |
| Operations | Admin usage overview and account-plan management |

## How it works

The generation rewrite removes difficulty tiers and replaces Quick mode with Short article mode. Both reading modes generate their content in one request, with at most one validation retry. Bilingual output contains paired English/Chinese sentences and contextual word markers; the server derives highlights and alignment directly. Full dictionary details load on demand. See [bilingual generation](docs/bilingual-generation.md) and [mixed generation](docs/mixed-direct-generation.md) for prompts, budgets, validation, and testing limitations.

```mermaid
flowchart LR
  U["Learner"] --> W["Static web app<br/>public/"]
  W --> A["Express API<br/>server.js"]
  A --> O["302.ai · DeepSeek V3.2"]
  A --> P["Prisma ORM"]
  P --> D[(PostgreSQL)]
  A --> L["Favorites · Notebook · Usage · Admin"]
```

## Quick start

### Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL
- An OpenAI-compatible API key

### Installation

```bash
git clone https://github.com/YanYihann/Texta.git
cd Texta
npm install
```

Create a local environment file from the included example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

At minimum, configure the database and model provider:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/texta?schema=public
OPENAI_API_KEY=your_key
OPENAI_MODEL=deepseek-v3.2
OPENAI_MODEL_NORMAL=deepseek-v3.2
OPENAI_API_MODE=chat
OPENAI_BASE_URL=https://api.302.ai/v1
OPENAI_TIMEOUT_MS=60000
FRONTEND_ORIGIN=http://localhost:3000
PORT=3000
```

Initialize the schema and start the app:

```bash
npm run db:push --skip-generate
npm start
```

Open `http://localhost:3000`.

### Optional Next.js frontend

```bash
cd frontend-react
npm install
npm run dev
```

The Next.js version is under development and is not yet the production frontend.

## Study workflow

1. Register or sign in.
2. Paste vocabulary or phrases separated by commas or new lines, or import a TXT, Markdown, CSV, or JSON list.
3. Review spellcheck suggestions.
4. Generate an article while complete vocabulary cards are prepared in parallel. Existing cards are reused from a persistent database cache; only missing words require model output.
5. Select a highlighted word to immediately inspect its saved meanings, pronunciation, collocations, and sentence from the article. Clicking does not generate dictionary content. See [vocabulary preparation](docs/vocabulary-details.md).
6. Save the article or add unfamiliar words to the notebook.
7. Export the result for offline review.

## Deployment

| Component | Current target |
| --- | --- |
| Static frontend | GitHub Pages |
| Express API | Render / custom API domain |
| Database | PostgreSQL through Prisma |
| Next frontend | Development only in `frontend-react/` |

Production endpoints documented by the repository:

- Frontend: <https://texta.yanyihan.top/>
- API: <https://api-texta.yanyihan.top>
- Health: <https://api-texta.yanyihan.top/api/health>

The backend uses the 302.ai OpenAI-compatible chat endpoint with `deepseek-v3.2`. Keep the provider key in backend environment variables; the static frontend calls the Express API. The configured base URL may also include `/chat/completions`; the server normalizes that suffix.

The implemented interface tokens, typography, motion, and interaction rules are documented in [DESIGN.md](DESIGN.md). Product requirements are in [PRODUCT.md](PRODUCT.md).

Availability can change independently of the source repository.

## Repository map

```text
Texta/
├── public/                 # Production static frontend
├── frontend-react/        # Next.js rewrite in progress
├── prisma/schema.prisma   # PostgreSQL models
├── scripts/               # Project utilities
├── tools/                 # Additional tooling and submodules
├── server.js              # Express API entry point
├── .env.example           # Environment-variable reference
└── render.yaml            # Render deployment definition
```

## Privacy and security

- Submitted vocabulary and generated content may be sent to the configured AI provider. Do not submit confidential or personal information without authorization.
- Keep API keys, database URLs, admin credentials, and session secrets in environment variables only.
- Replace all example admin credentials before deployment.
- Review provider retention terms, CORS origins, cookie settings, database backups, and account deletion requirements before public use.

## Roadmap

- [x] Bilingual vocabulary-aware generation
- [x] Account sessions and daily quota tiers
- [x] Favorites, notebook, and mastery synchronization
- [x] VIP request and admin review flow
- [x] PDF and Word export
- [ ] Complete the Next.js frontend migration
- [ ] Add automated tests for authentication, quotas, and generation
- [ ] Expand deployment and recovery documentation

## Contributing

Issues and pull requests are welcome. For product or UX changes, include the user problem, expected behavior, screenshots when relevant, and any API or data-model impact.

## License

No `LICENSE` file is currently included. Add an explicit license before treating this repository as open-source software or redistributing it.

## Acknowledgments

README structure is inspired by [Best-README-Template](https://github.com/othneildrew/Best-README-Template) and the examples curated in [awesome-readme](https://github.com/matiassingers/awesome-readme).

<p align="right"><a href="#readme-top">Back to top</a></p>
