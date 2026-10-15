**English** | [简体中文](README.zh-CN.md)

<a id="readme-top"></a>

<div align="center">
  <a href="https://texta.yanyihan.top/"><img src="public/logo.svg" alt="Texta" width="168" /></a>
  <h1>Texta</h1>
  <p><strong>Turn your vocabulary into stories. Learn words in context.</strong></p>
  <p>Add words → Generate an article → Read in context → Save and review → Export study materials</p>
  <p>
    <a href="https://texta.yanyihan.top/">Web App</a> ·
    <a href="wechat-miniprogram/README.md">WeChat Mini Program</a> ·
    <a href="docs/desktop.md">Windows Desktop</a> ·
    <a href="docs/README.md">Documentation</a> ·
    <a href="https://github.com/YanYihann/Texta/issues">Report an Issue</a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/YanYihann/Texta/actions/workflows/test.yml"><img src="https://github.com/YanYihann/Texta/actions/workflows/test.yml/badge.svg" alt="Core tests" /></a>
  <a href="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml"><img src="https://github.com/YanYihann/Texta/actions/workflows/deploy-pages.yml/badge.svg" alt="Web deployment" /></a>
  <a href="frontend-react/package.json"><img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js 16" /></a>
  <a href="wechat-miniprogram/project.config.json"><img src="https://img.shields.io/badge/WeChat-Mini_Program-07C160?logo=wechat&logoColor=white" alt="Native WeChat mini program" /></a>
</p>

<details>
  <summary>Contents</summary>
  <ol>
    <li><a href="#about">About and Access</a></li>
    <li><a href="#preview">Screenshots</a></li>
    <li><a href="#features">Features by Platform</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#sync">Accounts and Data Sync</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#getting-started">Run the Web App and API Locally</a></li>
    <li><a href="#mini-program">Develop the WeChat Mini Program</a></li>
    <li><a href="#desktop">Run the Windows Client</a></li>
    <li><a href="#development">Checks and Tests</a></li>
    <li><a href="#deployment">Deployment and Releases</a></li>
    <li><a href="#structure">Project Structure and Documentation</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing and Contact</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<a id="about"></a>

## About and Access

Texta is a vocabulary learning app for IELTS preparation and everyday English study. Add words or phrases to generate bilingual articles or Chinese stories with English vocabulary embedded. Explore meanings, collocations, and usage in context, then review saved words or export study materials.

This repository contains the **Next.js web app, native WeChat mini program, Windows desktop client, and shared backend**.

| Platform | How to use it | Source and documentation |
| --- | --- | --- |
| Web | Open **[texta.yanyihan.top](https://texta.yanyihan.top/)** on a computer or mobile browser | [frontend-react/](frontend-react/) · [Web development](docs/next-frontend.md) |
| WeChat mini program | Search for **「Texta串词记」** in WeChat; see the development steps below for local previews | [wechat-miniprogram/](wechat-miniprogram/) · [Mini program guide](wechat-miniprogram/README.md) |
| Windows desktop | Install the client or run it from source; it loads the same website over the network | [desktop/](desktop/) · [Desktop guide](docs/desktop.md) |
| Shared API | Authentication, generation, dictionary cards, study libraries, and subscription data | [server.js](server.js) · [Deployment guide](docs/deployment.md) |

The mini program source version is `1.1.2`. Records dated October 7, 2026 report that `1.0.0` was released and `1.1.2` was uploaded pending review. These records do not establish the current WeChat review status. Updating GitHub does not publish a WeChat release.

<a id="preview"></a>

## Screenshots

### Web reading workspace

![Texta web app with bilingual reading and vocabulary details](docs/images/reading.png)

*An existing web interface capture showing English text, Chinese translations, and vocabulary cards. Visit the live app for the latest interface.*

### WeChat mini program

<p align="center">
  <img src="docs/images/mini-input.png" alt="Mini program vocabulary input and spelling assistance" width="240" />
  <img src="docs/images/mini-reading.png" alt="Mini program bilingual reading" width="240" />
  <img src="docs/images/mini-export.png" alt="Mini program export settings and preview" width="240" />
</p>

*Native simulator screenshots of vocabulary input, bilingual reading, and export previews, using test articles.*

<a id="features"></a>

## Features by Platform

| Feature | Web / Windows client | WeChat mini program |
| --- | --- | --- |
| Vocabulary input | Word and phrase chips, spelling suggestions, completion, and TXT / Markdown / CSV / JSON imports | Editable chips, spelling suggestions, completion, clipboard paste, and the same import formats |
| Article generation | Bilingual articles, Chinese stories with embedded English words, and short article mode | Bilingual and embedded English modes, plus short articles |
| Reading and vocabulary | Aligned highlights, contextual meanings, UK / US IPA, pronunciation, collocations, word formation, synonyms, and antonyms | Aligned highlights, a native vocabulary drawer, contextual meanings, IPA, collocations, word formation, synonyms, and antonyms |
| Reading preferences | Six themes, font sizes, Chinese / English interface, translation toggle, reading mode, and mobile layout | Six themes, font sizes, bilingual / English / glossary views; Chinese interface |
| Saving and review | Favorites, folders, vocabulary notebook, mastery tracking, and source articles | Favorites, notebook, mastery tracking, search, source articles, and review article generation; preserves cloud folder data |
| History and drafts | Local drafts and the latest 80 articles per account; history defaults to newest first | Local drafts and the latest 30 articles per account |
| Accounts | Email registration and login, plus WeChat linking status | WeChat quick login, email registration / login, new email binding, and existing account association with password verification |
| Library sync | Favorites, words, mastery preferences, and folders sync through the API | Uses the same API, preserving offline changes and deletion markers |
| Study exports | PDF and Word `.doc`; preview, title, translation, and margin settings | PDF, editable Word `.docx`, TXT, and article copying; export settings and preview |
| Plans and administration | Plan catalog, order flows, usage administration, and legacy review pages | Current plan, daily allowance, and backend connectivity checks; no in-app purchases, WeChat Pay, or admin console |

**Article PDF / Word exports include a three-column glossary: English word, part of speech, and Chinese translation.** On the web, hiding paragraph translations keeps glossary meanings visible. Sense numbers appear as small superscripts in articles and exports. The web reading view hides its policy and copyright footer after generating or opening an article.

Mini program PDFs are image-based documents generated with a local canvas; DOCX exports are editable OOXML documents. The web app exports Word files as HTML `.doc` documents.

Plans include Free / Plus / Pro, monthly subscriptions, and lifetime entitlements. Purchase availability depends on backend settings and the payment provider configuration. FastSpring test orders do not grant live entitlements. See [payment setup](FASTSPRING_SETUP.md).

<a id="usage"></a>

## Usage

1. Register or sign in on the web. In the mini program, WeChat quick login creates a free account on first use.
2. Paste or import vocabulary, then check the entries and spelling suggestions.
3. Choose a bilingual article or a Chinese story with embedded English words. Enable short article mode if needed.
4. Read the article and tap highlighted words for contextual meanings and vocabulary cards.
5. Save articles, add unfamiliar words to the notebook, and update mastery status. Sync material you want to keep before switching devices.
6. Preview and export study materials, including the glossary after the article.

Try this vocabulary list:

```text
sustainable, resilient, adapt, perspective, thrive, balance, curious,
journey, challenge, opportunity, achieve, discover, essential, improve, confidence
```

Content is model-generated; check meanings and usage against the article. Failed generation attempts trigger a refund attempt for reserved credits. Successfully prepared dictionary cards remain available for reuse.

<a id="sync"></a>

## Accounts and Data Sync

All clients connect to the same Express API. **Use the same account to access the same cloud study library.** A new WeChat account is not automatically associated with an existing web account just by entering an email address.

For an existing web account, open **「我的 → 账号设置 → 关联已有账号」** in the mini program (Profile → Account settings → Link existing account). Enter the original email and password. After verification, eligible WeChat account data is merged into the email account, whose plan is preserved. Existing orders, paid source entitlements, conflicting WeChat identities, or library limits can prevent automatic merging. See [account association and merging](docs/wechat-login.md).

| Data | Storage and behavior across clients |
| --- | --- |
| Account, plan, and credits | Stored on the server and shared when signed into the same account |
| Favorites, notebook, mastery, and folders | Cloud library with local caches; available across devices after syncing, with editing interfaces varying by client |
| Generated history and input drafts | Stored in the current browser or mini program; not automatically synced between devices |
| Theme, interface language, and font size | Local preferences set separately in each client |
| Vocabulary cards | Saved with articles; shared dictionary cards are cached on the server |

Clients fetch and merge library data before uploading, and keep local changes when the network fails. Snapshot sync still has a race window when multiple devices edit simultaneously. Save important history articles to favorites. The desktop client has separate browser storage and does not automatically read unsynced data from your regular browser.

<a id="architecture"></a>

## Architecture

| Component | Implementation |
| --- | --- |
| Web frontend | Next.js 16, React 19, TypeScript; static export to GitHub Pages |
| WeChat mini program | Native JavaScript, WXML, and WXSS; no npm dependencies in the runtime code |
| Windows client | Electron, electron-builder, and NSIS; loads the live website |
| Shared backend | Node.js and Express 4; authentication, library, generation, usage, and payment APIs |
| Database | Prisma 6 and PostgreSQL; accounts, libraries, dictionary cache, usage, and orders |
| Generation | OpenAI-compatible API; the repository's Render configuration uses 302.ai / DeepSeek V3.2 |
| Exports | Web: html2canvas / jsPDF / HTML Word; mini program: canvas PDF / OOXML DOCX |

```mermaid
flowchart LR
  Browser["Desktop / mobile browser"] --> Web["Next.js · GitHub Pages"]
  Desktop["Windows · Electron"] --> Web
  Web --> API["Express API"]
  Mini["Native WeChat mini program"] --> API
  API --> Generation["Article generation + vocabulary cards"]
  Generation --> Model["OpenAI-compatible model service"]
  API --> Prisma["Prisma"]
  Generation --> Prisma
  Prisma --> DB[(PostgreSQL)]
  API --> WeChat["WeChat identity verification"]
  API --> Payment["FastSpring"]
```

Article generation and preparation of missing vocabulary cards run concurrently. Dictionary cards are generated in batches and cached persistently. Bilingual and mixed article generation retries once at most after content validation fails; the overall operation can involve multiple model requests. See [bilingual generation](docs/bilingual-generation.md), [mixed generation](docs/mixed-direct-generation.md), and [vocabulary cards](docs/vocabulary-details.md).

<a id="getting-started"></a>

## Run the Web App and API Locally

You need **Node.js 22+, npm, PostgreSQL**, and an API key from a model provider. Using the hosted app requires no development setup.

### 1. Install dependencies

```bash
git clone https://github.com/YanYihann/Texta.git
cd Texta
npm ci
npm ci --prefix frontend-react
```

Installing root dependencies runs `prisma generate`. The optional design reference submodule `tools/awesome-design-md` is not required to run the app; a recursive clone is unnecessary.

### 2. Create local configuration

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react/.env.local.example frontend-react/.env.local
```

macOS / Linux:

```bash
cp .env.example .env
cp frontend-react/.env.local.example frontend-react/.env.local
```

Set your own values in the root `.env`, for example:

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

In `frontend-react/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

`.env.example` also documents optional administrator, session, and WeChat settings. Keep model keys, database passwords, admin passwords, WeChat AppSecret, and payment credentials on the server. Use `NEXT_PUBLIC_*` only for public configuration.

### 3. Initialize the database and start the app

Create an empty local PostgreSQL database and confirm that `DATABASE_URL` points to it:

```bash
npm run db:push -- --skip-generate
npm start
```

In another terminal, start the frontend:

```bash
npm run dev --prefix frontend-react
```

Web app: [localhost:3001](http://localhost:3001). API health check: [localhost:3000/api/health](http://localhost:3000/api/health). See the [deployment guide](docs/deployment.md) for upgrades to existing databases.

To preview a production static build:

```bash
npm run build --prefix frontend-react
npm start --prefix frontend-react
```

The preview runs at [127.0.0.1:4173](http://127.0.0.1:4173). Allow that origin in the backend when connecting to a local API. The repository's preview server serves the static export. See [Next.js frontend documentation](docs/next-frontend.md) for routes and legacy data compatibility.

<a id="mini-program"></a>

## Develop the WeChat Mini Program

1. Import **`wechat-miniprogram/`** into WeChat DevTools.
2. The configuration preserves the existing AppID. Maintainers need access to that app; other developers should use their own AppID and matching backend WeChat credentials.
3. Compile the project. Runtime pages do not require the DevTools npm build step. `miniprogram/config.js` contains only the public API address and other public settings.
4. For physical devices, configure the API's request domain in the WeChat administration console. For a local API, change the public address and adjust network validation for your development environment.
5. The backend `WECHAT_APP_ID` / `WECHAT_APP_SECRET` must match the mini program in use.

Check the mini program from the repository root:

```bash
npm run mini:check
npm run test:mini
```

Simulator automation requires additional development dependencies:

```bash
npm ci --prefix wechat-miniprogram
npm run mini:compile
```

`mini:compile` uses the locally installed WeChat DevTools compiler; set `WECHAT_COMPILER_ROOT` to override its location. See the **[mini program README](wechat-miniprogram/README.md)** for pages, API configuration, exports, simulator checks, and release steps.

<a id="desktop"></a>

## Run the Windows Client

```bash
npm run desktop:install
npm run desktop:start
npm run test:desktop
npm run desktop:build
```

The installer is written to `output/desktop/Texta-Setup-1.0.0-x64.exe`. You can also manually run [Build Windows Desktop](https://github.com/YanYihann/Texta/actions/workflows/build-desktop.yml) to obtain build artifacts and SHA-256 checksums. The client requires a network connection. Code signing and automatic updates are not configured, and the workflow does not automatically create a Release. See the [desktop guide](docs/desktop.md).

<details>
  <summary>Desktop client screenshot</summary>

![Texta Windows client](docs/images/desktop.png)

</details>

<a id="development"></a>

## Checks and Tests

Run from the repository root:

```bash
npm test
npm run lint --prefix frontend-react
npm test --prefix frontend-react
npm run build --prefix frontend-react
npm run mini:check
npm run test:mini
```

| Area | Coverage |
| --- | --- |
| Backend | WeChat identity, account merging, credits and billing, bilingual / mixed generation, dictionary caching, libraries, and sentence translation |
| Web | Legacy caches, account isolation, sync failure protection, edits during requests, bilingual alignment, export content and escaping; builds check TypeScript and static routes |
| Mini program | JS / JSON, pages, events, icons, input, reading, export layouts, sessions, account association, merging, and sync races |
| WeChat compilation | `npm run mini:compile` checks WXML / WXSS; requires local WeChat DevTools |
| Desktop | Install desktop dependencies, then run `npm run test:desktop`; see the desktop guide |

The GitHub **Core tests** workflow checks the backend, web frontend, and mini program. Core unit checks use local fixtures and do not call paid generation APIs. Real database concurrency, payment settlement, and physical device acceptance require separate checks; skipped database tests are not passes. See [development and verification](docs/development.md).

<a id="deployment"></a>

## Deployment and Releases

| Component | Configuration and release process |
| --- | --- |
| Web | [deploy-pages.yml](.github/workflows/deploy-pages.yml) builds `frontend-react/out/` and deploys to GitHub Pages, preserving the CNAME and legacy `.html` redirects |
| Express API | [render.yaml](render.yaml) defines the Render service; credentials are server environment variables |
| PostgreSQL | [prisma/schema.prisma](prisma/schema.prisma) defines the schema; back up data and validate schema changes before upgrades |
| WeChat mini program | Preview / upload with WeChat DevTools, then review and release through WeChat; independent of GitHub Pages |
| Windows | [build-desktop.yml](.github/workflows/build-desktop.yml) builds manually; public distribution is handled separately |

Live endpoints: [Web app](https://texta.yanyihan.top/) · [API health](https://api-texta.yanyihan.top/api/health). See [deployment](docs/deployment.md), [WeChat authentication](docs/wechat-login.md), and [FastSpring](FASTSPRING_SETUP.md) for full configuration.

<a id="structure"></a>

## Project Structure and Documentation

```text
Texta/
├── frontend-react/         # Next.js web frontend, routes, reading, and exports
├── wechat-miniprogram/     # Native mini program, assets, tests, and release records
│   ├── miniprogram/        # Pages, components, data, API, and export utilities
│   ├── scripts/            # Checks, compilation, and simulator verification
│   ├── tests/              # Mini program regression tests
│   └── project.config.json # WeChat DevTools import entry
├── desktop/                # Electron client, builds, and tests
├── auth/                   # WeChat identity, email association, and account merging
├── billing/                # Plans, credits, orders, and FastSpring
├── generation/             # Bilingual articles, mixed stories, and vocabulary cards
├── prisma/                 # Database schema
├── public/                 # Shared assets, fonts, word lists, policies, legacy web fallback
├── docs/                   # Development, deployment, feature guides, and screenshots
├── tests/                  # Backend regression tests and local preview fixtures
├── experiments/            # Generation experiments, datasets, and reports
├── scripts/                # Project utilities
├── tools/                  # Optional design reference submodule
├── .github/workflows/      # CI, web deployment, and desktop builds
├── .env.example            # Backend environment example
├── server.js               # Shared Express API entry
└── render.yaml             # Render deployment configuration
```

Start with the **[documentation index](docs/README.md)**, or see the [web frontend](docs/next-frontend.md), [mini program](wechat-miniprogram/README.md), [desktop client](docs/desktop.md), and [generation experiments](experiments/README.md). Detailed development guides are primarily in Chinese. Each client's product and design constraints are kept in its `PRODUCT.md` / `DESIGN.md`.

The repository includes runnable source, lockfiles, static assets, tests, and development documentation. Local `.env` files, user data, database backups, private DevTools settings, historical backups, dependencies, debug logs, and build outputs are excluded by `.gitignore` and remain local.

<a id="roadmap"></a>

## Roadmap

- [x] Bilingual articles, mixed stories, vocabulary cards, and persistent caching
- [x] Next.js web frontend and Windows client
- [x] Native WeChat mini program, WeChat login, and email account association
- [x] Study library sync, vocabulary review, and exports with glossaries
- [x] Web, mini program, and backend source and checks in one repository
- [ ] Expand real PostgreSQL concurrency and rollback verification
- [ ] Improve conflict handling for simultaneous edits across devices
- [ ] Complete live payment activation and settlement acceptance
- [ ] Add desktop signing, download distribution, and automatic updates

These are development directions without committed delivery dates. WeChat review and release status is determined in the WeChat administration console.

<a id="contributing"></a>

## Contributing and Contact

Use [Issues](https://github.com/YanYihann/Texta/issues) to report steps to reproduce, expected behavior, and actual results. Update the relevant documentation and run the checks for your changes. Generation, authentication, and library changes should account for vocabulary validation, refunds on failure, account isolation, and legacy data compatibility.

Maintainer: [YanYihann](https://github.com/YanYihann) · Email: [1963372275@qq.com](mailto:1963372275@qq.com).

<a id="license"></a>

## License

This repository does not currently include a project-level `LICENSE` or grant an open-source license for the project as a whole. Fonts, word lists, and third-party code retain their own license files in `public/fonts/`, `public/vendor/`, and `wechat-miniprogram/miniprogram/data/`.

<p align="right"><a href="#readme-top">Back to top</a></p>
