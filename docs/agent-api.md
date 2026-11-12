# Agent management API

These five endpoints manage saved agents and prompt presets. They do not start voice calls. Run `npm run db:migrate` before using them.

## Authentication and request rules

All requests require a valid Better Auth session cookie. For browser integration, use relative `/api/...` URLs through Vite's proxy in development or the same-origin Express server in production.

POST and PATCH require `Content-Type: application/json` and an `Origin` header equal to the origin configured by `BETTER_AUTH_URL` (locally, `http://localhost:5173`). Browsers send this header automatically for these same-origin writes. When manually testing with an API client, supply it explicitly along with the session cookie.

Owners and timestamps are controlled by the server. Clients cannot submit `id`, `ownerId`, `createdAt`, or `updatedAt`. Reusable helpers in `backend/src/services/prisma-service.ts` use Prisma Client for database operations. Reads/updates filter by both agent ID and signed-in owner where applicable. Responses use `Cache-Control: no-store`.

## 1. GET /api/agent-templates

Returns `200` with `{ "templates": [...] }`. The array includes Custom (`custom`, empty prompt), General assistant (`assistant`), Customer support (`support`), and Receptionist (`receptionist`). Each entry contains `id`, `title`, `description`, `prompt`, `color`, and `background`.

Preset text comes from `backend/src/config/agent-templates.ts`. Selecting a preset does not create a database record. The client copies its prompt into the editor and submits the edited text when the user saves. Later changes to a preset do not change previously saved agents.

## 2. POST /api/agents

Request:

```json
{
  "name": "Willow",
  "prompt": "You are a helpful voice assistant. Keep replies clear and brief.",
  "templateId": "assistant"
}
```

`name` and `prompt` are required. `templateId` defaults to `custom` when omitted. Success returns `201`, a `Location: /api/agents/<id>` header, and `{ "agent": { ... } }`.

Agent fields are `id` (UUID), `name`, `prompt`, `templateId`, `createdAt`, and `updatedAt` (UTC ISO date strings). Ownership is assigned from the session and is not included in the public record.

Validation trims surrounding whitespace, requires a nonempty name of at most 100 characters and a nonempty prompt of at most 12,000 characters, and accepts only the four supported template IDs. A preset choice is informational; the submitted prompt is the actual saved content. A custom agent must have a prompt before it can be saved.

## 3. GET /api/agents

Returns `200` with `{ "agents": [...] }`, containing only agents owned by the signed-in user. The initial version returns the full owned list, ordered by most recently updated, with creation time and ID as deterministic tie-breakers. An account without agents receives an empty array. Query parameters cannot select a different owner.

## 4. GET /api/agents/:id

Returns `200` with `{ "agent": { ... } }` for an owned agent. Invalid UUIDs return `400`. Missing agents and agents owned by another user return the same `404` response:

```json
{ "message": "Agent not found." }
```

## 5. PATCH /api/agents/:id

Send one or more of `name`, `prompt`, and `templateId`:

```json
{ "name": "Willow Support" }
```

Returns `200` with `{ "agent": { ... } }`. Omitted fields remain unchanged, and `updatedAt` advances. Empty bodies, unknown fields, null fields, or invalid values return `400`. Ownership is checked in the UPDATE statement itself; another user's agent cannot be modified.

## Errors

- `400`: invalid fields, invalid UUID, empty update, or malformed JSON.
- `401`: missing or expired session.
- `403`: missing or untrusted origin on a write.
- `404`: missing or inaccessible agent.
- `413`: JSON body exceeds 96 KB. Valid maximum-length Unicode/escaped prompts fit within this limit.
- `500`: unexpected server failure; database details are not exposed.

All errors contain a `message`. Schema validation errors also contain `errors`, an array of `{ "field": "name", "message": "..." }` entries. Database failures never include SQL or connection credentials in the response.

## Current integration status

The UI uses these endpoints for account-backed agent persistence. Unsaved edits stay in form state and are discarded on refresh or navigation. Browser voice calls use the saved agent through separate [call-session endpoints](web-calls.md); knowledge bases remain deferred.
