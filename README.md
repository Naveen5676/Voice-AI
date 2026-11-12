# Voice Studio

React + Material UI frontend, Express + Better Auth backend, and a separate Python LiveKit voice worker. The Node apps are npm workspaces: install and run commands from this repository's root. The root `package-lock.json` is the single Node lockfile.

The backend follows OpenMic's TypeScript-to-CommonJS build pattern: `npm start` runs `node dist/server.js`, and the compiled server uses `require`/`exports`. Database models live in `backend/prisma/schema.prisma`; reusable Prisma helpers replace handwritten agent CRUD queries. Better Auth uses the same Prisma client through its Prisma adapter. See [backend structure and database setup](docs/backend-structure.md).

## Authentication scope

- Email/password signup automatically signs in and opens `/dashboard`.
- Login opens the same dashboard; logout revokes the server session.
- Sessions last seven days and renew during active use.
- The protected dashboard lists PostgreSQL-backed agents and offers prompt starting points.
- Google login, email verification, password recovery, and telephony are deferred.

## Agents and browser calls

After signing in, use `/dashboard` to create an agent or choose General assistant, Customer support, or Receptionist. `/agents/new` opens a new editor; `/agents/:agentId` edits a saved agent. Names and prompts are validated using `backend/src/validator/agent.validator.ts`, reused by the frontend's Zod resolver.

Agents now load and save through the protected PostgreSQL-backed APIs. The editor awaits explicit saves and keeps unsaved edits only in form state. Refreshing or leaving discards unsaved changes without confirmation.

Web Call uses the selected agent's saved instructions. The browser joins LiveKit with a room-scoped token; Express dispatches the separate Python worker, which fetches a server-owned prompt snapshot. The dialog provides distinct user/agent transcript bubbles, a microphone selector, explicit microphone permission, connection status, mute, end-call, and error handling. Save new or edited agents before starting a call.

See [browser call setup, endpoints, and verification](docs/web-calls.md). Authentication and agent management work without voice credentials. For calls, configure the same LiveKit project, worker dispatch name, and service secret in the backend and worker, then run `npm run dev:agent` from the root in a separate terminal. This loads the worker environment before the LiveKit CLI checks credentials and targets the isolated `voice-studio-local` deployment.

## Local development

Use Node.js 22.13+ (Node 24 recommended), npm, and PostgreSQL.

```sh
npm install
```

Choose one database setup:

**Existing local PostgreSQL or Neon:** create a database, copy `backend/.env.example` to `backend/.env`, and set `DATABASE_URL` and a randomly generated `BETTER_AUTH_SECRET`. For Neon, use its provided connection URL with TLS enabled. Never put secrets in a `VITE_` variable.

**Isolated local PostgreSQL:** with PostgreSQL's command-line tools installed, run:

```sh
npm run setup:local
```

On Windows, this defaults to `C:/Program Files/PostgreSQL/18/bin`. Set `PG_BIN` to another PostgreSQL bin directory when needed; on other systems the tools are found through PATH. This helper creates a password-protected cluster under ignored `.local/postgres`, listens only on `127.0.0.1:55439`, creates `voice_studio`, and writes generated credentials and an auth secret to ignored `backend/.env`. It does not alter your system PostgreSQL service. Re-run the helper to start the local cluster after a reboot. Its development role owns only this isolated cluster; use a dedicated application role for hosted databases.

Then run:

```sh
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to Express on port 3001. Keep `BETTER_AUTH_URL` equal to the browser's public origin; `localhost` and `127.0.0.1` are different origins. The Python worker is not required for authentication.

To stop the isolated database, use `pg_ctl -D .local/postgres -m fast -w stop` from the repository root with the PostgreSQL tools on PATH. Stop the web app first. Database files and `.env` remain available for the next start.

## Structure

```text
backend/src/
  config/        Validated environment and preset prompts
  db/            Shared Prisma client factory and PostgreSQL adapter
  lib/           Authentication configuration
  middleware/    Server validation, session checks, and error handling
  validator/     Auth and agent Zod schemas reused by frontend form validation
  routes/        Protected account and agent APIs
  services/      Agent logic and reusable owner-scoped Prisma helpers
  app.ts         Express application factory
  server.ts      Startup and graceful shutdown
frontend/src/
  app/           Redux store and Material UI theme
  components/    Shared brand and session route boundary
  features/auth/ Reusable controls, pages, auth client calls
  features/agents/ Agent editor, account-scoped API cache, voice controls
  features/dashboard/ Agent list and template starting points
  lib/           Better Auth client
agent/           Existing Python LiveKit service
scripts/         Optional isolated database setup
backend/prisma/  Database schema and Prisma SQL migrations
```

Better Auth owns password hashing, cookies, and session persistence. React Hook Form uses Zod through `zodResolver`. RTK Query provides one shared session cache containing public user fields; credential submissions remain outside Redux actions. No localStorage authentication persistence is used. Session checks refresh on focus, reconnect, and every minute; backend authorization is checked independently on each protected API request.

## APIs

- `GET /api/health`: process health.
- `/api/auth/*`: Better Auth's supplied handlers (signup, login, session, logout).
- `GET /api/me`: public user profile fields, or `401` without a valid session.
- `GET /api/agent-templates`: Custom plus the three preset prompts.
- `POST /api/agents`: create an agent owned by the signed-in user.
- `GET /api/agents`: list the signed-in user's agents, newest update first.
- `GET /api/agents/:id`: read one owned agent.
- `PATCH /api/agents/:id`: update an owned agent's name, prompt, or template choice.
- `POST /api/agents/:id/web-calls`: start an owned agent's browser call.
- `GET /api/web-calls/:callId`: read owned call status.
- `POST /api/web-calls/:callId/end`: end an owned call.

See [the agent API reference](docs/agent-api.md) for request bodies, response shapes, and status codes. All five agent endpoints require a valid Better Auth session. Agent writes also require an `Origin` header matching `BETTER_AUTH_URL`. Ownership always comes from the session, and unknown ownership fields in request bodies are rejected.

Auth writes require a trusted origin. Signup and login each allow five attempts per minute per client IP, stored in PostgreSQL. Express overwrites the internal IP header before forwarding requests to Better Auth. Set proxy trust only for the deployment's actual proxy topology.

## Verification

```sh
npm run typecheck
npm run build
npm test
npm run test:ui
```

Integration tests use `TEST_DATABASE_URL` pointing to a PostgreSQL role allowed to create and drop databases. They create a uniquely named database, migrate it, exercise real HTTP requests, and drop only that database afterward. Without `TEST_DATABASE_URL`, the integration test is explicitly skipped and environment validation still runs.

PowerShell, using the local development role for tests:

```powershell
$env:TEST_DATABASE_URL = (Get-Content backend/.env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
npm test
```

Tests cover cookie flags, hashing, signup, duplicate email, invalid credentials, trusted origins, rate limiting, session restoration, logout, expiry, and protected APIs. Agent tests cover all five endpoints, account isolation, create/read/update persistence, field validation, malformed JSON, Unicode prompts, and repeatable Prisma migrations. Tests also verify timestamp handling on the local non-UTC PostgreSQL host.

## Render preparation

Use one Node Web Service connected to this monorepo, with **Root Directory left blank**:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, a random `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://your-service.onrender.com`, and `TRUST_PROXY_HOPS=1` for Render's reverse proxy.

Run `npm run db:migrate` against the target database before starting the app, and whenever the database schema changes. It runs Prisma's `migrate deploy`; both authentication and agents are defined in the same Prisma schema, with migration history in `_prisma_migrations`. The previous `app_migrations` table is retained as historical data. The existing local database has already been baselined without recreating tables. Other databases created with the old migration runner need the one-time baseline described in [database setup](docs/backend-structure.md) before deploying Prisma migrations. On a free hosting plan without a pre-deploy command, apply migrations from your local terminal using the target database configuration. Do not use the local setup helper for hosted databases.

Express serves `frontend/dist` alongside the APIs in production, including direct visits to `/login`, `/signup`, and `/dashboard`. Unknown `/api` routes stay JSON 404s. Production sessions use Secure, HttpOnly cookies. The `agent/` service is deployed separately; no Python deployment is triggered by Node build commands. Production voice setup is described in [browser calls](docs/web-calls.md). This repository has not been published or deployed by this implementation.
