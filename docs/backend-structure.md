# Backend structure

The backend follows the reference OpenMic project's core pattern: TypeScript compiled to CommonJS, a Prisma schema, and reusable database helper functions. The frontend keeps Vite's ESM configuration.

## CommonJS runtime

`backend/package.json` declares `type: commonjs`. TypeScript's NodeNext compiler emits CommonJS JavaScript, including `require()` and `exports`, into `backend/dist`. Source files keep TypeScript imports and types, as OpenMic does. There is no top-level await or import.meta in server code.

`npm start` launches `node dist/server.js`. The verified runtime is Node 24. Modern Node is required because some dependencies, including Better Auth, publish ESM that Node loads from the CommonJS application. The existing Node 22.13+ engine requirement is retained; Node 24 is recommended.

## Schema and database helpers

- `backend/prisma/schema.prisma`: users, accounts, sessions, verification, rate limits, and agents. Prisma model and field mappings preserve existing PostgreSQL table and column names.
- `backend/prisma/migrations/`: versioned SQL generated for Prisma Migrate. The initial migration also preserves the existing agent CHECK constraints, which Prisma schema syntax cannot represent.
- `backend/prisma.config.ts`: Prisma schema path, migration path, and database URL from the environment.
- `backend/src/db/prisma.ts`: one Prisma Client factory, with PostgreSQL connection pooling and UTC connection settings.
- `backend/src/services/prisma-service.ts`: reusable `createAgent`, `getAgents`, `getAgent`, and `updateAgent` helpers using `prisma.agent` methods.
- `backend/src/services/agent.service.ts`: application behavior and consistent not-found errors.
- `backend/src/routes/agents.ts`: HTTP handling, session checks, origin checks, and request validation.

The same Prisma client is supplied to the agent helpers and Better Auth's Prisma adapter. Each agent query includes the authenticated owner. An update filters by both ID and owner in the update operation; it does not depend on a separate ownership check that could become stale.

Manual `pool.query` CRUD and the custom application migration runner have been removed from the server. Administrative database setup and disposable integration tests still use PostgreSQL directly where necessary.

Prisma 7 is pinned by major version because the installed Better Auth adapter supports its client API. The generated client is configured with `moduleFormat = "cjs"`, ignored by Git, and generated during package installation and backend builds. Prisma's PostgreSQL connections use UTC so timestamp handling stays consistent on the local Asia/Calcutta database server; the database's global timezone is unchanged.

## Fresh databases

Set `backend/.env`, then run from the repository root:

```sh
npm install
npm run db:migrate
npm run build
npm start
```

The initial migration creates authentication and agent tables together. No baseline command is needed for an empty database.

## Existing databases from the previous implementation

The current local development database has already been checked and baselined. Existing user, account, session, and agent records were fingerprinted before and after; their contents were unchanged.

For another database with the previous schema, first set the target URL in your local environment and compare it with the Prisma schema. Run inside `backend/`:

```sh
npx prisma migrate diff --config prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma
```

Only after confirming that the existing tables match, record the initial migration as already applied:

```sh
npm run db:baseline
npm run db:migrate
```

`db:baseline` marks `0001_initial` as applied; it does not run its CREATE TABLE statements. Do not run it on an empty database. A database whose schema differs needs its differences resolved before baselining. No reset or destructive db-push command is part of this workflow.

## Future schema changes

Edit `schema.prisma`, then create a development migration with `npm run db:migrate:dev -w backend -- --name <change-name>`. Review and commit the migration. Deploy it using `npm run db:migrate` from the repository root. Regenerate the client with `npm run db:generate -w backend` when changing models; the normal backend build also regenerates it.

References: [Prisma CommonJS generator](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators), [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma), [Prisma baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining), and [PrismaPg timezone issue](https://github.com/prisma/orm/issues/28629).
