<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong> · <a href="README.ru.md">Русский</a> · <a href="README.hi.md">हिन्दी</a> · 繁體中文（待翻譯）
</p>

<p align="center">
  <a href="https://csrg3b.top/">
    <img src="public/branding/classhub-logo-384-d01f9050a1.webp" width="280" alt="ClassHub" />
  </a>
</p>

<h1 align="center">ClassHub</h1>

<p align="center">
  <strong>Class updates, learning resources, and everyday tasks—all in one place.</strong>
</p>

<p align="center">
  An information platform for campus classes: announcements, news, activities, resources, conversations, class administration, and AI assistance.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&amp;logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22 deployment environment" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&amp;logoColor=white" alt="MongoDB 8 deployment environment" />
</p>

<p align="center">
  <a href="https://csrg3b.top/">Website</a> ·
  <a href="https://csrg3b.top/about">About</a> ·
  <a href="https://csrg3b.top/privacy">Privacy</a> ·
  <a href="https://github.com/Mason1035/uniclub-main/issues">Report an issue</a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="#docs">Documentation</a> ·
  <a href="#faq">FAQ</a>
</p>

---

<a id="overview"></a>

## Overview

ClassHub currently serves **Software Engineering Class 3, entering cohort of 2025, at Sichuan Normal University**. Members can find class updates, read news, join activities, share resources, post updates, and handle class tasks. Administrators use the same system to manage content, the roster, registrations, and submission records.

The project uses a React + TypeScript frontend and a Node.js + Express + MongoDB backend, with real accounts, access control, content management, AI services, and object storage integrations. Each deployment currently uses one class roster; it does not provide multi-tenant or multi-class administration.

The homepage, About page, and privacy page provide public product information. Class pages require login, and the administration area requires administrator permissions. A public code repository does not make class member information or operational data public, and the project does not represent an official university organization.

**This README describes the implementation in the current repository.** The deployed version, available content, and external service status may differ. The presence of code does not mean that every environment has been configured or deployed.

### Contents

- [Features](#features)
- [Pages and usage](#usage)
- [Technology and architecture](#architecture)
- [Quick start](#quick-start)
- [Environment and external services](#configuration)
- [Administrators and class roster](#accounts)
- [AI and daily news](#ai)
- [Development, builds, and verification](#development)
- [Deployment and operations](#deployment)
- [Security, privacy, and known limitations](#security)
- [Project structure and content maintenance](#structure)
- [Documentation](#docs)
- [FAQ](#faq)
- [Contributing and reporting issues](#contributing)
- [Contributors, licensing, and assets](#credits)
- [README translations](#translations)

<a id="features"></a>

## Features

### Member area

| Module | Implemented capabilities |
| --- | --- |
| Homepage | Recent announcements, activities, resources, and news, plus a small selection of class updates and activity memories; full collections are available in their respective sections |
| Announcements and notifications | Class announcements, personal notifications, unread status, and marking notifications as read |
| News | News listings, article content, interactions, and an AI conversation about the current article |
| Activities | Activity stages, calendar, type and year filters; registration requests, personal approval status, and cancellation; summaries, albums, and past activities |
| Learning resources | Resource listings, details, links, download entry points, and usage records |
| Class feed | Text and image posts, discussion, interactions, saved content, and the existing follow and visibility rules |
| Site search | Content accessible to the current account, using the shared search dialog |
| Assessment materials | ZIP submissions during open collection periods, submission status, resubmission before the deadline, and downloading your own files |
| Class fees | Payment QR codes, payment screenshots and notes, and administrator confirmation status |
| Random roll call | Uniform selection from the real eligible member pool, presented as an avatar album cover with a vinyl record; supports drawing again |
| Accounts and settings | Login with a student ID or account identifier, password changes, profile, avatar, preferences, and saved content |
| Default avatars | Avatars assigned from the library using a stable account identifier when no avatar has been uploaded; consistent across pages and devices |
| Web desktop pet | Optional pet, skins, interactions, and account-linked preferences; see the [pet documentation](docs/classhub-pet.md) |

### Administration area

| Module | Implemented capabilities |
| --- | --- |
| Dashboard | An overview of existing class content and operations |
| Roster and members | Importing the real class roster, managing members, and account permissions |
| Content management | News, resources, announcements/notifications, and existing album records |
| Activity management | Drafts and publishing, timing and capacity, registration review and batch operations, unregistered member counts, albums, summaries, archiving, hiding, and restoring |
| Assessment materials | Collection periods, opening times, submitted/missing members based on the real roster, record filtering, and downloads |
| Class fee management | Payment QR code settings, proof review, manual reconciliation, and receipt confirmation |
| AI assistant | Text and image assistance, scenario-based generation, editable publishing previews, follow-up revisions, cancellation, and streamed responses |
| AI daily news | Schedule, quantity, and category settings; retrieval, validation, batch publishing, run status, failure reasons, and job history |

### Interaction and presentation

- Responsive header, mobile bottom navigation, centered footer, and shared forms, dialogs, and feedback components.
- Brand preloader on the first visit: waits for the current route, above-the-fold fonts, and visible images; avoids replaying within the session and includes a timeout and keyboard skip.
- The About page includes smooth scrolling, original geometric illustrations, and developer cards moving along an arc. It does not display the site header.
- A dedicated 404 page reuses the brand, existing search, and a local astronaut illustration.
- Animations respect `prefers-reduced-motion`; mobile and touch devices use appropriate layouts and scrolling behavior.
- **The current application uses a fixed light theme.** Historical dark styles or theme-related dependencies do not mean that a dark mode switch is available.

<a id="usage"></a>

## Pages and usage

| Page | Path | Access |
| --- | --- | --- |
| Homepage / About / Privacy | `/`, `/about`, `/privacy` | Public product information |
| Login | `/auth` | Sign in with a class account |
| Announcements / News / Activities | `/announcements`, `/news`, `/events` | Signed-in members |
| Resources / Class feed | `/resources`, `/social` | Signed-in members |
| Notifications / Saved content / Settings | `/notifications`, `/saved-posts`, `/settings` | Current account |
| Class functions | `/functions` | Signed-in members |
| Material submission / Class fees | `/quantification`, `/fees` | Signed-in accounts; individual operations are checked by the backend |
| Random roll call | `/functions/random-call` | Current eligible class members |
| Administration area | `/admin` | Administrators verified by the backend |
| Admin AI / Daily news | `/admin/ai`, `/admin/ai#daily-news` | Administrators |

News articles use `/article/:id`, with `/news/:id` retained for compatibility. Activity details use `/events/:id`, with `/event/:id` retained. Resource details use `/resource/:id`. News Q&A is at the bottom of the article page; it is not a separate public chat page.

Students sign in with accounts provisioned by the class administrator, then use the navigation to open the relevant section. Administrators prepare the real roster, publish content, open collection periods, and configure external services. Pages show appropriate empty or error states when content has not been published or a service is unavailable.

<a id="architecture"></a>

## Technology and architecture

| Layer | Technology and implementation |
| --- | --- |
| Frontend | React 18, TypeScript 5, Vite 5, React Router 6 |
| Data and components | TanStack React Query, Axios, Tailwind CSS, Radix UI, Lucide, React Markdown |
| Animation | GSAP 3.15, `@gsap/react`; ScrollTrigger / ScrollSmoother loaded as needed for About |
| Backend | Node.js, Express 5, CommonJS; routes, business services, and repositories |
| Database | MongoDB, Mongoose 8 |
| Authentication | bcrypt password hashing, JWT, database account/administrator checks, and `tokenVersion` session revocation |
| AI | Shared `DeepSeekAssistant`, SSE, controlled web search, and article extraction |
| Images and files | Multer, Sharp, Tencent Cloud COS / SCF, short-lived signatures, and direct browser uploads |
| Public page rendering | Real visitor HTML for the homepage, About, and Privacy generated at build time, with React interactions at runtime |
| Deployment | ECS / Nginx / systemd; the repository also includes Vercel configuration |
| Mobile | Responsive web, Web App Manifest, Capacitor configuration, and an Android project |

```text
Browser / React pages
    |
    +-- Development: Vite proxies /api and /uploads
    +-- Production: Nginx reverse proxy / separate API origin
            |
            v
        Express API
            +-- JWT / account / permission checks
            +-- Service / Repository -- MongoDB
            +-- DeepSeekAssistant -- DeepSeek
            |        +-- NewsAPI / publisher RSS / controlled web retrieval
            +-- Protected storage services -- SCF / COS
                                               ^
                       Browser uploads or downloads with short-lived authorization
```

The main data models include `User`, `EnrolledUser`, `News`, `Announcement`, `Event`, `ActivityMedia`, `Resource`, `SocialPost`, `Notification`, `Chat`, `AiSettings`, and `DailyNewsJob`, plus models for assessment collection periods, submissions, uploads, class fee settings, and payment proofs. Features reuse the existing users and roster rather than maintaining a second student dataset.

<a id="quick-start"></a>

## Quick start

### 1. Prepare the environment

- Git, Node.js, and npm. The existing ECS deployment uses **Node.js 22**; using the same major version locally is recommended. The repository does not enforce an `engines` constraint.
- An accessible MongoDB instance. The existing deployment uses MongoDB 8. Some operations support standalone MongoDB, and replica set transactions are not a prerequisite for startup.
- AI and cloud uploads are optional external services. Without configuration, those features are unavailable; public product pages remain accessible.

### 2. Clone and install dependencies

```bash
git clone https://github.com/Mason1035/uniclub-main.git
cd uniclub-main
npm ci
npm --prefix uniclub-backend ci
```

Alternatively, `npm run install-all` runs `npm install` for both the frontend and backend. GSAP dependencies come from packages included in `vendor/`; keep that directory when cloning, building, and deploying.

### 3. Configure the backend

Copy the example file:

```bash
cp uniclub-backend/.env.example uniclub-backend/.env
```

Windows PowerShell:

```powershell
Copy-Item uniclub-backend/.env.example uniclub-backend/.env
```

Edit `uniclub-backend/.env` and provide at least:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/uniclub
JWT_SECRET=replace_with_a_long_random_private_secret
PORT=5050
REQUIRE_ENROLLED_ROSTER=true
ALLOWED_EMAIL_DOMAINS=
```

The connection string is a local example; replace `JWT_SECRET`. NewsAPI / Gemini placeholder values in the example are not valid keys and should be cleared when the corresponding services are unused. The current DeepSeek setup is described below and does not require a Gemini key.

If `mongod` is already installed, run it in a separate terminal:

```bash
npm run mongo
```

The script binds to `127.0.0.1:27017` by default and stores data in `~/data/db`; it does not install MongoDB. Skip this step if a database service is already running. Use `MONGOD_BIN`, `MONGODB_DBPATH`, and `MONGODB_PORT` to override the local executable, data directory, or port.

### 4. Start the frontend and backend

```bash
npm start
```

| Service | Default address |
| --- | --- |
| Frontend | <http://localhost:8081> |
| Backend health check | <http://localhost:5050/api/health> |
| About | <http://localhost:8081/about> |
| Login / Administration | <http://localhost:8081/auth> / <http://localhost:8081/admin> |

The backend starts listening only after connecting to the database. On first use, [initialize the administrator and class roster](#accounts). The public homepage does not create members or operational content automatically.

You can also run `npm run backend` and `npm run frontend` in separate terminals. The standard startup commands work on Windows. The legacy `start:win` / `stop:win` scripts still assume port 5000 and terminate processes on ports, so they are not recommended as the default startup method.

<a id="configuration"></a>

## Environment and external services

### Where configuration lives

| Configuration | Location and purpose |
| --- | --- |
| Backend connections, authentication, and server secrets | `uniclub-backend/.env` or protected environment variables on the production server |
| Frontend development proxy | `VITE_API_PROXY_TARGET` in the root `.env.local`; defaults to `http://localhost:5050` |
| Production frontend API URL | `VITE_API_URL` at build time; leave empty for a same-origin reverse proxy, or set the API origin for a separate host without appending `/api` again |
| DeepSeek API key | Set in `/admin/ai` and stored encrypted in `AiSettings` |
| Storage settings | Admin assessment-material storage settings, saved in a private configuration file; `QUANTIFICATION_STORAGE_CONFIG_PATH` can override its location |

**`VITE_*` variables are included in the browser build and must never contain secrets.** The old root `.env.example` contains `VITE_API_URL=http://localhost:5000`; this is not the current development proxy port and should not be copied directly into production configuration.

When changing the backend port, set the proxy target in the root `.env.local` before starting:

```dotenv
VITE_API_PROXY_TARGET=http://localhost:5051
```

The root startup script uses this target to select the backend port. If you also set `PORT`, keep the two values consistent. Changing production `VITE_API_URL` requires rebuilding the frontend.

### Optional services

| Service | Configuration | Without configuration |
| --- | --- | --- |
| DeepSeek | Initialize `AI_SECRET_ENCRYPTION_KEY`, restart the backend, then save the API key and test the connection in the admin area | Admin AI, news Q&A, and daily generation are unavailable |
| News search | Existing `NEWS_API_KEY`; the shared retrieval layer can also use fixed publisher RSS feeds | RSS can supplement results, subject to source, freshness, and network limits |
| Direct COS adapter | `OBJECT_STORAGE_PROVIDER=cos`, `COS_BUCKET`, `COS_REGION`, `COS_SECRET_ID`, `COS_SECRET_KEY` | Real material uploads are unavailable |
| SCF + COS | Private bucket, region, function invocation URLs, matching server authentication, and admin storage settings | The corresponding cloud uploads/downloads are unavailable |
| Activity media | Protected SCF, `CLASSHUB_SCF_AUTH_SECRET`, permissions limited to the activity prefix, and CORS | Activity originals and thumbnails cannot be saved correctly |
| Production request origins | Set `CORS_ORIGINS` and `BACKEND_URL` for the actual domains | Cross-origin requests or generated links may fail |
| Authenticated Cron | `CRON_SECRET` | External Cron requests are rejected |

Storage also requires cloud resources, private access policies, CORS, and persistent directories. `npm start` does not create Tencent Cloud buckets, functions, or roles. The current implementation supports COS and does not include a ready-to-use OSS adapter. Activities and assessment materials share storage configuration, with separate object prefixes and business permissions.

See the [assessment material guide](docs/quantification.md), [SCF setup](uniclub-backend/cloud-functions/quantification/README.md), and [activity COS guide](docs/activity-v2/ACTIVITY_V2_COS.md). These documents include historical implementation records; use the current source and target environment to determine the effective configuration.

<a id="accounts"></a>

## Administrators and class roster

### Initialize an administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend's private environment, optionally `ADMIN_NAME` and `ADMIN_UNIQUE_ID`, then run from the repository root:

```bash
npm run admin:create
```

- Login uses the **student ID / account identifier `uniqueId`**, not the email address. A standalone administrator's default identifier follows the `ADMIN-...` format.
- If an existing account matches, the script may grant it administrator permissions. Existing passwords are preserved unless `ADMIN_UPDATE_PASSWORD=true` is explicitly set.
- Remove initialization variables from the long-term environment after use. Do not put real passwords in the README, command examples, or Git.
- To change an existing administrator password, use the terminal command with hidden password input: `npm run admin:password -- admin@example.com`. This email is an example. Changing the password invalidates previous sessions.

### Import the class roster

CSV, TSV, and JSON are supported. Student ID and name are required; email is optional. Example CSV with fictional members:

```csv
uniqueId,name
202500001,Example Member A
202500002,Example Member B
```

Check the import first, then write it:

```bash
npm run roster:import -- ./roster.csv --dry-run
npm run roster:import -- ./roster.csv
```

`--dry-run` does not change accounts, roster entries, or indexes. A real import creates missing login accounts. **The initial password is the student ID and should be changed on first login.** Repeated imports preserve existing passwords, roles, and profiles. Never commit a real roster to the public repository.

The default registration policy requires the email and student ID to match the roster. The main workflow currently imports accounts and allows direct student ID login. `REQUIRE_ENROLLED_ROSTER=false` disables the roster check during registration; it should not be used as a routine workaround for incorrect roster data.

The random roll call pool is the intersection of `User.isEnrolled` and `EnrolledUser.uniqueId`, with no exclusion based on administrator role. Student administrators on the roster are included; standalone administrators outside the roster are not. Every draw uses the full pool and can select the same member consecutively. Browser `crypto.getRandomValues()` with rejection sampling avoids modulo bias.

<a id="ai"></a>

## AI and daily news

### One shared AI service

The admin assistant, news Q&A, and daily news reuse `DeepSeekAssistant`, the same database configuration, and the same key. They do not create separate AI keys or clients. The current code uses `deepseek-flash` and `https://api.deepseek.com`; model selection is centralized in the shared service.

Initialize the encryption master key:

```bash
npm --prefix uniclub-backend run ai:init-secret
```

Restart the backend, enter the DeepSeek API key in `/admin/ai`, and test the connection. The master key is a 32-byte Base64 value; the API key is stored using AES-256-GCM encryption. Back up both the database and master key. Losing or replacing the master key prevents decryption of the saved API key, which must then be entered again.

### Admin content assistant

Supports text/image input, 12 scenarios, streamed generation, Markdown output, follow-up revisions, and cancellation. **Resource descriptions, announcement drafts, news articles, and activity copy** provide publishing previews for their respective sections. After editing, validation, and confirmation, content is published through the original business APIs. Generating content does not automatically publish it.

### News Q&A

- The frontend sends only the article ID and question. `GET/POST /api/chat/:articleId` reads trusted article content, article visibility, and the current user's history on the server.
- Summaries, article viewpoints, and organization extraction prioritize the article itself. Questions such as “why,” impact analysis, and comparisons can enable reasoning.
- Requests about the latest status, current events, follow-up developments, or explicit lookups trigger shared search when needed. External web content is treated as untrusted reference data, not system instructions.
- Long articles and conversation history have context budgets. SSE displays responses in chunks, using the existing Markdown renderer; external sources come only from actual retrieval.
- If search fails, the model can fall back to the article. Conversations use the existing `Chat` model and are separated by user and article. Questions are limited to 1,000 characters.
- Backend rate limits and concurrency protection apply. News Q&A defaults to 20 requests per user per 10 minutes. This is currently in-memory protection in a single process, not a distributed quota system.

### AI daily news

Manage settings, status, and job history in `/admin/ai#daily-news`. Defaults are `19:00` Beijing time and two articles per day. The quantity is configurable from one to five articles, covering artificial intelligence, technology, software engineering, science, and education.

```text
Scheduled check / administrator-confirmed run
    -> NewsAPI + publisher RSS retrieval
    -> Freshness, publisher, and source validation
    -> Topic selection, source reading, generation, and fact review
    -> Stage a complete batch
    -> Switch the visible batch on success; retain manual articles and old batch records
```

The job uses real sources published within the preceding 24 hours. Insufficient reliable sources or failed validation will not be filled with invented content or replace the most recent successful batch. Old AI news is archived by batch; manually created news is not automatically deleted.

The persistent backend process checks scheduled jobs under `NODE_ENV=production`. Development startup does not automatically call paid AI services. Vercel Cron uses the protected `/api/cron/daily-news` endpoint, requires `CRON_SECRET`, and needs a plan supporting the configured frequency and sufficient execution time.

Run manual diagnostics from the backend directory:

```bash
cd uniclub-backend
node manual-curation.js --dry-run
```

**This `--dry-run` still makes real network requests and calls paid AI; it only prevents saving news.** Without the flag, the command attempts to publish. `--force` explicitly regenerates the day's batch. Legacy curation commands now use the unified daily news workflow; do not configure them using the old Gemini task scheduled at Dallas midnight.

NewsAPI's free Developer plan delays retrieved articles by 24 hours and is officially limited to development and testing, excluding staging and production. Production use of this provider requires a suitable plan. See [NewsAPI's official pricing](https://newsapi.org/pricing). RSS can supplement sources, but local success does not guarantee that server networking, source pages, or every publication date will work. See the [daily news documentation](uniclub-backend/README.daily-news.md) for implementation details. Verify AI output and citations; costs depend on the provider and actual usage.

<a id="development"></a>

## Development, builds, and verification

### Common commands

Run these commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm start` / `npm run dev` | Start frontend and backend together |
| `npm run frontend` / `npm run backend` | Start one side only |
| `npm run mongo` | Start an already installed local MongoDB |
| `npm run typecheck` | TypeScript checks for the frontend and Vite configuration |
| `npm run lint` | Check source using the current ESLint configuration |
| `npm run build` | Type checking, Vite build, and public SEO HTML generation |
| `npm run preview` | Preview `dist/`; does not start the backend or database |
| `npm test` | Backend and pet tests; does not include every specialized frontend script |
| `npm --prefix uniclub-backend run test:ai` | Admin AI tests |
| `npm run test:seo` | Public page and deployment route checks; requires a build first |
| `npm run test:pet` | Pet tests |
| `npm run admin:create` / `npm run roster:import -- ...` | Initialize administrators and roster; writes to the database according to the arguments |
| `npm run curate:news` | Manual daily news job; may call paid services and write news |
| `npm run daily-curator` | Separate scheduler process; usually unnecessary if the production main process already runs the scheduler |

Choose existing focused checks according to the change:

```bash
node scripts/test-news-chat.mjs
node scripts/test-ai-preview.mjs
node scripts/test-daily-news-ui.mjs
node scripts/test-activity-frontend.mjs
node scripts/test-random-call.mjs
node scripts/test-default-avatars.mjs
node scripts/test-preloader.mjs
node scripts/test-request-sharing.mjs
node scripts/test-not-found.mjs
```

Some backend integration checks require MongoDB or an isolated test environment. SEO serving checks skip real Nginx response checks when Nginx is unavailable. Passing tests does not verify third-party AI services, cloud permissions, physical-device browsers, or the production environment. For everyday changes, run directly related checks and necessary builds; a full-site regression is not required each time.

<a id="deployment"></a>

## Deployment and operations

### Frontend output and HTTP routes

`npm run build` generates `dist/`, including:

- `index.html`, `about.html`, `privacy.html`: real content for visitors.
- `app.html`: the private application shell for login, member pages, and administration.
- `404.html`: the unknown-route page.
- `sitemap.xml`, `seo-routes.json`, `static/`, and public assets.

Do not indiscriminately route all unknown URLs to the homepage. Deployment must distinguish public pages, the private shell, API proxying, and real 404 responses. Canonical URLs, robots directives, JSON-LD, and the sitemap cover only reviewed public product pages.

### ECS / Nginx / systemd

The repository includes release, backup, and rollback procedures for the existing server; see [`deploy/ecs/README.md`](deploy/ecs/README.md). It uses a persistent Node.js process, MongoDB, and Nginx, matching the current requirements for file-based configuration, uploads, and background jobs.

After verifying SSH access, target directories, and environment configuration, maintainers can run:

```bash
bash deploy/ecs/push.sh
```

This command builds, transfers, and switches the server release. **It is not a one-command installer for an arbitrary new server.** Verify the target before running it.

Deployment considerations:

- Keep backend environment files, uploads, and private storage configuration outside release directories. Include them in protected backups, not Git or frontend bundles.
- Serve public HTTPS through Nginx. Bind the backend and database to loopback or private network interfaces as appropriate for the deployment topology.
- Configure the actual production `CORS_ORIGINS`. Use `TRUST_PROXY=loopback` only for the corresponding local reverse proxy topology.
- Configure the proxy for SSE streaming with sufficient timeouts. Avoid intermediary caching or buffering that prevents incremental output.
- After a release, check health, login, public HTML, static assets, 404 responses for unknown URLs, and the features affected by the change.
- Back up at least MongoDB, uploaded files, storage settings, and the AI master key. Rolling back code does not roll back the database.

### Vercel and mobile projects

`vercel.json` includes build, API, public page, static asset, 404, and Cron configuration. Disk uploads, private configuration writes, in-process rate limits, and long-running AI tasks require platform-specific adaptation. Do not assume every existing feature can move unchanged to serverless deployment.

The repository includes Capacitor configuration and an Android project, which still contain historical `Uniclub` application identifiers. A responsive website and Web App Manifest do not mean that Android/iOS apps have been published or that class data is available offline.

### Data upgrades

Existing scripts cover pet default preferences, class fee initialization, daily news, and Activity V2. They are in `uniclub-backend/migrations/` or backend scripts. Back up first, read the target script and module documentation, then decide whether to run it; do not execute the entire directory indiscriminately.

The Activity V2 migration defaults to dry-run, uses an explicit `ACTIVITY_MIGRATION_MONGO_URI`, and writes only with `--apply`. Remote targets also require `--allow-remote`. Class fee initialization uses `npm --prefix uniclub-backend run fees:init`; the daily news compatibility script is `uniclub-backend/migrations/20261006_daily_ai_news.js`. These operations are separate from a normal frontend build.

<a id="security"></a>

## Security, privacy, and known limitations

| Area | Current behavior and boundaries |
| --- | --- |
| Permissions | The backend verifies real accounts, session versions, and administrator status. Hidden frontend links, robots directives, and noindex do not replace API or media authorization |
| Legacy APIs and media | Some older anonymous endpoints and media links still require a separate audit. The project does not claim that all operational data is fully private; see the [SEO/GEO audit](docs/SEO_GEO_AUDIT.md) |
| Class scope | One class per deployment; no multi-tenant isolation, school-wide administration, or class switching |
| Class fees | One current record per user; screenshots are stored in the database and reconciled manually by administrators. No payment gateway, automatic receipt detection, OCR, refunds, or ledger spanning multiple fee periods |
| Assessment materials | ZIP files up to 500 MiB, multipart uploads, and retries within the session. No virus scanning; refreshing an incomplete upload usually requires selecting the file again. No complete file-handle-based resumption across page loads |
| Activity albums | JPEG / PNG / WebP, up to 10 MiB per image, with generated WebP thumbnails. Thumbnails strip metadata; originals may retain EXIF. New media uses controlled signed access |
| Random roll call | The intersection of roster entries and eligible accounts; roster entries without provisioned accounts are excluded. Repeated draws are allowed; there is no non-repeating mode |
| AI | Keys stay on the server. Verify generated output. Search, generation, quotas, and costs depend on external services |
| Multiple processes | AI rate limits currently operate in process memory; dynamic storage configuration also has single-process lock boundaries. Evaluate these before scaling |
| Files and backups | COS objects, MongoDB data, and local files are managed separately. Keep real rosters, payment screenshots, ZIP submissions, environment files, and backups out of the public repository |

Users can read the [privacy and browser storage information](https://csrg3b.top/privacy). Historical verification records in feature documentation do not mean every issue has been resolved in the current production deployment.

For issues involving accounts, keys, or member privacy, do not post exploit details, real data, or credentials in a public issue. Report through an established private contact channel with the maintainers, then publish a sanitized fix description after confirmation. The repository currently has no separate `SECURITY.md` or guaranteed response timeline.

<a id="structure"></a>

## Project structure and content maintenance

```text
uniclub-main/
├── src/
│   ├── components/              # Header, footer, search, AI chat, and shared UI
│   ├── context/                 # Account, authentication, dialogs, and theme state
│   ├── features/pet/            # Production web desktop pet
│   ├── pages/                   # Member pages, About, and administration
│   ├── lib/                     # Requests, sessions, motion, uploads, and utilities
│   ├── styles/                  # Design tokens and shared styles
│   ├── seo/                     # Build-time public page rendering
│   └── routeConfig.tsx          # Site route definitions
├── public/                      # Branding, fonts, default avatars, pets, and static assets
├── shared/                      # Shared business rules and the public SEO allowlist
├── uniclub-backend/
│   ├── index.js                 # Express entry point and job integration
│   ├── routes/                  # Member, admin, and authenticated Cron APIs
│   ├── middleware/              # Authentication, permissions, privacy, and responses
│   ├── models/                  # MongoDB models
│   ├── services/                # Business, AI, search, and storage services
│   ├── cloud-functions/         # Tencent Cloud SCF code
│   ├── jobs/                    # Scheduled jobs
│   ├── migrations/              # Incremental migrations
│   ├── scripts/                 # Roster, administrator, and operations utilities
│   └── test/                    # Backend tests
├── test/                        # Focused frontend test sources
├── scripts/                     # Startup, build, asset processing, and focused checks
├── docs/                        # Feature guides, audits, reports, and archived documentation
├── deploy/ecs/                  # Nginx, systemd, releases, backups, and rollback
├── vendor/                      # GSAP packages distributed with the repository
├── design-experiments/          # Independent design experiments, not production routes
├── dsh-niulai-pet-master/        # Upstream pet reference project
├── android/                     # Capacitor Android project
├── tokens.css                   # Global fonts, colors, and design tokens
├── package.json                 # Root development commands and frontend dependencies
└── vercel.json                  # Vercel deployment configuration
```

| What to change | Main location |
| --- | --- |
| About content and developers | `src/pages/AboutPage.tsx`, `src/pages/about/` |
| Homepage tagline and typing parameters | `src/pages/Homepage.tsx`, `src/components/AnimatedTerminalText.tsx` |
| Header, footer, and page shell | `src/components/SiteHeader.tsx`, `SiteFooter.tsx`, `Layout.tsx` |
| Fonts, colors, and interaction styles | Root `tokens.css` and `src/styles/`; font sources in `FONT_NOTES.md` |
| Routes | `src/routeConfig.tsx`, `src/routes.tsx` |
| Public SEO copy and scope | `shared/seo.json`, `src/lib/seo.ts`, `scripts/build-seo.mjs` |
| Axios / SSE requests | `src/lib/axios.ts`, `src/lib/aiStream.ts` |
| AI models, context, and retrieval | `uniclub-backend/services/DeepSeekAssistant.js` and the shared search services |

<a id="docs"></a>

## Documentation

| Document | Contents |
| --- | --- |
| [ECS deployment](deploy/ecs/README.md) | Releases, health checks, backups, rollback, and persistent directories |
| [Admin AI](uniclub-backend/README.ai.md) | Keys, scenarios, publishing previews, and service implementation |
| [AI daily news](uniclub-backend/README.daily-news.md) | Retrieval, freshness, scheduling, batch publishing, and failure diagnostics |
| [Assessment materials](docs/quantification.md) | Collection periods, ZIP files, COS, uploads, and downloads |
| [Class fees](docs/fees.md) | Payment proofs and manual confirmation |
| [Activity design](docs/activity-v2/ACTIVITY_V2_DESIGN.md) | Activity lifecycle, registration, media, and compatibility boundaries |
| [Activity API](docs/activity-v2/ACTIVITY_V2_API.md) | Member and administrator API contracts |
| [Activity COS](docs/activity-v2/ACTIVITY_V2_COS.md) | Cloud storage, SCF, permissions, and live integration records |
| [Activity test report](docs/activity-v2/ACTIVITY_V2_TEST_REPORT.md) | Verification results and uncovered cases |
| [SCF functions](uniclub-backend/cloud-functions/quantification/README.md) | Function deployment and protected invocation |
| [Web desktop pet](docs/classhub-pet.md) | Production features, preferences, sources, and capabilities not migrated |
| [Fonts](FONT_NOTES.md) | Font sources, usage, subsets, and licenses |
| [GSAP packages](vendor/README.md) | Local dependencies and build conventions |
| [SEO / GEO audit](docs/SEO_GEO_AUDIT.md) | Public boundaries, HTML, indexing, deployment, and remaining work |
| [Legacy UniClub archive](docs/archive/legacy-uniclub/README.md) | Historical architecture and operating records, not the current startup guide |

Most linked technical guides are currently in Chinese. Some documents retain deployment, testing, and incident records from when they were written. Check historical ports, UI states, and “complete/incomplete” conclusions against the current source; they are not statements of today's production status.

<a id="faq"></a>

## FAQ

### Why does localhost:8081 refuse the connection?

Check that `npm start` is running, dependencies are installed, and port 8081 is free. If backend startup fails, inspect the terminal for MongoDB and environment configuration errors. `ERR_CONNECTION_REFUSED` means no service is reachable on the target port; refreshing the page cannot fix it.

### Why do API requests fail when the frontend opens normally?

Check <http://localhost:5050/api/health>, then compare `VITE_API_PROXY_TARGET` with the actual backend port. The development proxy and production `VITE_API_URL` serve different purposes. A separate production API host also needs correct CORS. The health endpoint can return 503 when the database is disconnected.

### Why are there no class updates on the homepage, or why can I not open administration?

The visitor homepage shows public product information and does not read class content. After login, available content depends on published records. Administration requires administrator permissions in the database. Changing frontend buttons or forging a role field does not grant those permissions.

### Why does news generation return `SEARCH_NO_RESULTS` or `INSUFFICIENT_SOURCES`?

Inspect retrieved results, independent publishers, readable article content, and freshness in the job records. A valid key does not guarantee enough reliable sources. Free NewsAPI delays, RSS failures, or server connectivity can affect results. The job does not fill gaps by widening the freshness window, disabling validation, or inventing news.

### Why does AI work locally but fail after deployment?

Compare the target environment's AI master key, database settings, search connectivity, source extraction, proxy timeouts, and job duration. Identical frontend settings do not imply identical server keys, networking, or persistent directories. Use job error codes to locate the failing stage.

### Why do uploads report unavailable storage or a CORS error?

Check admin storage settings, the private bucket, function authentication, permissions limited to the required prefixes, the actual site origin, and request headers. Activity media must not reuse an unprotected legacy credential function. Retrieve a new signature when it expires instead of making the bucket public to bypass the issue.

### Why is someone missing from random roll call?

Check that the person exists in both the real current roster and eligible member accounts. Roster entries without an eligible account are not part of the pool. Administrator status itself does not exclude someone, but a standalone administrator outside the roster is not a class member for random selection.

### Can I deploy multiple classes, enable dark mode, or publish a mobile app directly?

These are not completed product capabilities. Multiple classes require an explicit data isolation design; the current theme is fixed to light mode. The mobile project still needs branding, signing, platform configuration, and appropriate verification.

<a id="contributing"></a>

## Contributing and reporting issues

Report reproducible problems through [Issues](https://github.com/Mason1035/uniclub-main/issues), or submit improvements through pull requests.

- Include the page, reproduction steps, expected and actual results, and device environment. Remove sensitive information from screenshots and logs first.
- Follow the existing routes, request layer, user models, components, and design tokens. Avoid introducing duplicate authentication, AI, or storage systems.
- For changes affecting member data, permissions, costs, cloud resources, or migrations, explain their scope, recovery behavior, and verification limits.
- Preserve third-party attribution and license notices; update documentation alongside relevant changes.
- Run related tests, lint, type checks, or builds according to the change. Do not describe mocked API checks as live production verification.
- There is currently no separate `CONTRIBUTING.md` or formal `CHANGELOG.md`. This section and the relevant module documentation describe the contribution conventions.

<a id="credits"></a>

## Contributors, licensing, and assets

The repository is maintained by [Mason1035](https://github.com/Mason1035) and other contributors. Members involved in development and operations include **He Yuxuan (何宇轩), Zhang Pengfei (张鹏飞), and Li Qingyuan (李青原)**. Individual code contributions are available in the repository's commit history.

There is currently no project-wide `LICENSE` at the root. The backend package's ISC metadata, dependency licenses, font OFL licenses, and pet engine's MIT license do not grant a single license for the entire project and all assets. Confirm the applicable scope with the maintainers before copying, redistributing, or using the project commercially.

| Source | Notes |
| --- | --- |
| Main application fonts | Source Han Serif, Source Han Sans, Smiley Sans, and Schibsted Grotesk; sources and OFL texts are documented in [FONT_NOTES.md](FONT_NOTES.md) |
| About English font | Space Grotesk; its [OFL license](public/fonts/classhub/SpaceGrotesk-OFL.txt) is retained |
| Pet engine | Adapted from whitefirer's dsh-niulai-pet; the [MIT license](public/pet-assets/LICENSE) and [asset notices](public/pet-assets/NOTICE.md) are retained |
| User-provided character, audio, and avatar assets | Code or engine licensing does not automatically grant rights to third-party assets; verify each asset's applicable rights separately |
| GSAP and other dependencies | Their package licenses are retained; local GSAP packages are documented in [vendor/README.md](vendor/README.md) |

<a id="translations"></a>

## README translations

The Simplified Chinese README is the source for translations. Completed versions are linked; planned versions remain unlinked until their files exist.

| Language | Status |
| --- | --- |
| 简体中文 (Simplified Chinese) | Available: [README.md](README.md) |
| English | Available: [README.en.md](README.en.md) |
| Русский (Russian) | Available: [README.ru.md](README.ru.md) |
| हिन्दी (Hindi) | Available: [README.hi.md](README.hi.md) |
| 繁體中文 (Traditional Chinese) | Planned |

Translations preserve the same features, commands, limitations, and links; they do not add capabilities absent from the Chinese version. Additional languages can be added as needed.

---

<p align="center">
  <a href="https://csrg3b.top/">ClassHub</a> · Sichuan Normal University · Software Engineering Class 3, 2025 cohort
</p>
