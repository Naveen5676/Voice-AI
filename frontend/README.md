# Voice Studio frontend

React, TypeScript, Material UI, React Hook Form with Zod validation, and Redux Toolkit's session cache.

Run installation, development, builds, and tests from the repository root. See [the project README](../README.md) for database setup, environment configuration, and deployment instructions.

Routes: `/login`, `/signup`, `/dashboard`, `/agents/new`, and `/agents/:agentId`. Workspace routes are protected by the backend authentication session.

The agent dashboard and editor currently save drafts in this browser, separated by the signed-in user's ID. Web Call is an informational preview; agent account APIs and voice integration will follow. Run `npm run test:ui` from the repository root for the UI data and validation checks.
