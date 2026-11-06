# Voice Studio

React + Material UI frontend, Express + Better Auth backend, and a separate Python LiveKit voice worker. The Node apps are npm workspaces: install and run commands from this repository's root. The root `package-lock.json` is the single Node lockfile.

## Authentication scope

- Email/password signup automatically signs in and opens `/dashboard`.
- Login opens the same dashboard; logout revokes the server session.
- Sessions last seven days and renew during active use.
- The protected dashboard lists browser-saved agent drafts and offers three prompt starting points.
- Google login, email verification, password recovery, agent account APIs, and voice integration are deferred.

## Agent UI preview

After signing in, use `/dashboard` to create an agent or choose General assistant, Customer support, or Receptionist. `/agents/new` opens a new editor; `/agents/:agentId` edits a saved draft. Names and prompts are validated using `backend/src/validator/agent.validator.ts`, reused by the frontend's Zod resolver.

The agent UI is a frontend milestone: drafts are stored under an account-specific key in this browser's localStorage. They are not synced to PostgreSQL, shared across devices, or sent to the Python worker. A local repository adapter isolates this temporary persistence so agent APIs can replace it in the next phase. Authentication still uses the existing backend and PostgreSQL.

The editor has explicit save, unsaved-change navigation warnings, and confirmation before replacing a prompt with a template. Web Call opens an informational dialog; it does not request microphone access or start a voice session. Save new or edited agents before opening that dialog.

Run `npm run test:ui` for draft persistence, account separation, corrupted storage, input validation, and preset checks. Real agent ownership checks and voice sessions will be added with their backend APIs.

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
  config/        Validated environment
  db/            PostgreSQL pool and Better Auth migrations
  lib/           Authentication configuration
  middleware/    Server validation, session checks, and error handling
  validator/     Auth Zod schemas reused by frontend form validation
  routes/        Protected account API
  app.ts         Express application factory
  server.ts      Startup and graceful shutdown
frontend/src/
  app/           Redux store and Material UI theme
  components/    Shared brand and session route boundary
  features/auth/ Reusable controls, pages, auth client calls
  features/agents/ Agent editor, Redux drafts, presets, browser storage adapter
  features/dashboard/ Agent list and template starting points
  lib/           Better Auth client
agent/           Existing Python LiveKit service
scripts/         Optional isolated database setup
```

Better Auth owns password hashing, cookies, and session persistence. React Hook Form uses Zod through `zodResolver`. RTK Query provides one shared session cache containing public user fields; credential submissions remain outside Redux actions. No localStorage authentication persistence is used. Session checks refresh on focus, reconnect, and every minute; backend authorization is checked independently on each protected API request.

## APIs

- `GET /api/health`: process health.
- `/api/auth/*`: Better Auth's supplied handlers (signup, login, session, logout).
- `GET /api/me`: public user profile fields, or `401` without a valid session.

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

Tests cover cookie flags, hashing, signup, duplicate email, invalid credentials, trusted origins, rate limiting, session restoration, logout, expiry, and protected APIs.

## Render preparation

Use one Node Web Service connected to this monorepo, with **Root Directory left blank**:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, a random `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://your-service.onrender.com`, and `TRUST_PROXY_HOPS=1` for Render's reverse proxy.

Run `npm run db:migrate` once against the target database before starting the app, and whenever the auth schema changes. This is deliberately explicit rather than a server startup side effect. On a free hosting plan without a pre-deploy command, apply it from your local terminal using the target database configuration. Do not use the local setup helper for hosted databases.

Express serves `frontend/dist` alongside the APIs in production, including direct visits to `/login`, `/signup`, and `/dashboard`. Unknown `/api` routes stay JSON 404s. Production sessions use Secure, HttpOnly cookies. The `agent/` service is deployed separately; no Python deployment is triggered by Node build commands. This repository has not been published or deployed by this implementation.
