<a id="top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Last Commit][last-commit-shield]][last-commit-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/YanYihann/Texta">
    <img src="public/logo.svg" alt="Texta Logo" width="180">
  </a>

  <h3 align="center">Texta</h3>

  <p align="center">
    An IELTS vocabulary writing assistant that turns word lists into bilingual, study-ready output.
    <br />
    一个面向雅思词汇记忆与写作练习的智能辅助平台。
    <br />
    <br />
    <a href="https://github.com/YanYihann/Texta"><strong>Explore the Repository »</strong></a>
    <br />
    <br />
    <a href="https://yanyihann.github.io/Texta/">Live Demo</a>
    ·
    <a href="https://api-texta.yanyihan.top/api/health">API Health</a>
    ·
    <a href="https://github.com/YanYihann/Texta/issues">Report Bug</a>
    ·
    <a href="https://github.com/YanYihann/Texta/issues">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#why-texta">Why Texta</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#project-structure">Project Structure</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

Texta is a full-stack IELTS vocabulary writing assistant designed to make vocabulary practice less fragmented and more actionable.

Instead of memorizing isolated words, users can submit a word list and generate:

- an English article that tries to cover the target vocabulary,
- a Chinese translation aligned to the English content,
- highlighted word usage with meaning markers,
- a glossary panel with parts of speech, senses, collocations, synonyms, antonyms, and word formation,
- exportable study output for review and revision.

The project also includes a complete account system, daily usage limits, VIP approval flow, favorites, notebook synchronization, and an admin dashboard for operation and usage tracking.

Production currently serves the static frontend from `public/` on GitHub Pages, while the Node.js + Express API is deployed on Render behind a custom domain. The `frontend-react/` directory contains an in-progress Next.js rewrite for a more modern frontend experience.

<p align="right">(<a href="#top">back to top</a>)</p>

## Why Texta

What makes Texta different from a simple "input words, get passage" tool:

- Vocabulary-first workflow: the product is built around target-word retention, not generic essay generation.
- Bilingual alignment: English and Chinese content are connected through visual highlighting and sense markers.
- Study loop support: favorites, notebook entries, mastery states, and history reduce one-off usage.
- Real product mechanics: login, plans, quotas, VIP request review, and admin endpoints make it usable beyond a local demo.
- Progressive frontend evolution: the current production UI is stable, while `frontend-react/` prepares a richer React/Next.js experience.

## Built With

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Prisma](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [OpenAI API](https://platform.openai.com/)
- [GitHub Pages](https://pages.github.com/)
- [Render](https://render.com/)
- [Next.js](https://nextjs.org/) for the ongoing frontend rewrite

## Architecture

```mermaid
flowchart LR
    A["GitHub Pages<br/>Static Frontend"] --> B["Express API<br/>server.js"]
    B --> C["Prisma ORM"]
    C --> D["PostgreSQL"]
    B --> E["OpenAI API"]
    F["Admin Panel"] --> B
    G["Favorites / Notebook / Sync"] --> B
```

### Current deployment shape

- `public/`: production static frontend uploaded to GitHub Pages
- `server.js`: Express backend handling auth, usage, library sync, admin flows, spellcheck, and generation
- `prisma/schema.prisma`: PostgreSQL schema for users, sessions, usage, favorites, notebook entries, vocab preferences, and VIP requests
- `frontend-react/`: Next.js rewrite under active development

### Core backend capabilities

- Authentication: register, login, logout, profile session lookup
- Usage control: free, VIP, and admin quotas
- Generation pipeline: vocabulary-aware article generation with model selection
- Vocab detail API: richer word-level explanation and glossary enrichment
- Spellcheck: input vocabulary validation before generation
- Library sync: favorites, notebook entries, and vocab mastery synchronization
- Admin operations: VIP review, usage overview, user plan adjustment

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm
- PostgreSQL database
- An OpenAI-compatible API key

### Installation

1. Clone the repository.

   ```bash
   git clone https://github.com/YanYihann/Texta.git
   cd Texta
   ```

2. Install backend dependencies.

   ```bash
   npm install
   ```

3. Create your environment file.

   ```bash
   copy .env.example .env
   ```

4. Update `.env` with your own values.

   ```env
   OPENAI_API_KEY=<your_openai_api_key>
   DATABASE_URL=postgresql://postgres:password@localhost:5432/texta?schema=public
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_MODEL_NORMAL=gpt-4o-mini
   OPENAI_MODEL_ADVANCED=gpt-4o
   ADVANCED_USAGE_COST=5
   OPENAI_API_MODE=chat
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_TIMEOUT_MS=30000
   OPENAI_RETRY_COUNT=2
   FRONTEND_ORIGIN=http://localhost:3000,https://yanyihann.github.io
   AUTH_TOKEN_TTL_MS=604800000
   ADMIN_EMAIL=admin@example.com
   ADMIN_NAME=Admin
   ADMIN_PASSWORD=change_this_password
   PORT=3000
   ```

5. Sync the Prisma schema to your database.

   ```bash
   npm run db:push --skip-generate
   ```

6. Start the backend.

   ```bash
   npm start
   ```

7. Open the local app.

- Static frontend pages are served by Express from `public/`
- Default local address: `http://localhost:3000`

### Optional: run the Next.js rewrite

If you want to work on the new React frontend:

```bash
cd frontend-react
npm install
npm run dev
```

## Usage

### Main study flow

1. Register an account or sign in.
2. Enter vocabulary items separated by newlines or commas.
3. Let Texta spellcheck the list before generation.
4. Generate an article and review bilingual highlighting.
5. Open single-word details to inspect senses, collocations, and word formation.
6. Save useful results to favorites or send unfamiliar words into the notebook.
7. Export the final result as PDF or Word for later review.

### Built-in product features

| Area | What it does |
| --- | --- |
| Auth | User registration, login, session-based access |
| Usage control | Free users get daily quotas, VIP gets expanded limits, admin is unrestricted |
| Generation | Creates vocabulary-aware content from a word list |
| Alignment | Connects English and Chinese sections through highlighted mapping |
| Glossary | Shows POS, senses, collocations, synonyms, antonyms, and word formation |
| Library | Favorites, history-like saved content, notebook entries, mastery preferences |
| Export | PDF and Word export flow from the frontend |
| Admin | VIP review queue, usage overview, manual plan changes |

### Production endpoints

- Frontend: [https://yanyihann.github.io/Texta/](https://yanyihann.github.io/Texta/)
- Backend API base: [https://api-texta.yanyihan.top](https://api-texta.yanyihan.top)
- Health check: [https://api-texta.yanyihan.top/api/health](https://api-texta.yanyihan.top/api/health)

## Project Structure

```text
.
├── .github/workflows/deploy-pages.yml   # GitHub Pages deployment
├── data/                                # Local data or auxiliary assets
├── frontend-react/                      # Next.js rewrite
├── prisma/
│   └── schema.prisma                    # Database schema
├── public/                              # Production static frontend
├── scripts/                             # Helper scripts
├── tools/                               # Extra tooling and submodules
├── .env.example                         # Environment variable template
├── package.json                         # Backend scripts and deps
├── render.yaml                          # Render deployment config
└── server.js                            # Main API server
```

### Database models

- `User`
- `Session`
- `UsageDaily`
- `UsageLog`
- `VipRequest`
- `FavoriteArticle`
- `NotebookEntry`
- `UserVocabPref`

## Roadmap

- [x] User authentication and session handling
- [x] Daily quota system with free / VIP / admin tiers
- [x] VIP request submission and admin review flow
- [x] Vocabulary-aware bilingual article generation
- [x] Rich glossary and single-word detail enhancement
- [x] Favorites, notebook, and cloud sync endpoints
- [x] PDF / Word export flow
- [ ] Complete the `frontend-react/` migration
- [ ] Add automated tests for critical backend flows
- [ ] Improve deployment docs and developer onboarding

See the [open issues](https://github.com/YanYihann/Texta/issues) for a full list of proposed features and known problems.

## Contributing

Contributions, issues, and feature ideas are welcome.

If you'd like to help:

1. Fork the project
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add some amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

If you are improving UX or study flow, it helps a lot to include:

- the exact user problem,
- before/after screenshots or behavior notes,
- and any API or data-model impact.

## Contact

- GitHub: [@YanYihann](https://github.com/YanYihann)
- Project Link: [https://github.com/YanYihann/Texta](https://github.com/YanYihann/Texta)
- Issues: [https://github.com/YanYihann/Texta/issues](https://github.com/YanYihann/Texta/issues)

## Acknowledgments

- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) for the README structure inspiration
- [Shields.io](https://shields.io/) for repository badges
- [Prisma](https://www.prisma.io/) for database tooling
- [Render](https://render.com/) and [GitHub Pages](https://pages.github.com/) for easy deployment

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/YanYihann/Texta.svg?style=for-the-badge
[contributors-url]: https://github.com/YanYihann/Texta/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/YanYihann/Texta.svg?style=for-the-badge
[forks-url]: https://github.com/YanYihann/Texta/network/members
[stars-shield]: https://img.shields.io/github/stars/YanYihann/Texta.svg?style=for-the-badge
[stars-url]: https://github.com/YanYihann/Texta/stargazers
[issues-shield]: https://img.shields.io/github/issues/YanYihann/Texta.svg?style=for-the-badge
[issues-url]: https://github.com/YanYihann/Texta/issues
[last-commit-shield]: https://img.shields.io/github/last-commit/YanYihann/Texta.svg?style=for-the-badge
[last-commit-url]: https://github.com/YanYihann/Texta/commits/main
