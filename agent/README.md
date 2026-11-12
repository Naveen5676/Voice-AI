# Voice Studio worker

A separate Python LiveKit worker that uses each saved Voice Studio agent's instructions. The browser never calls Python directly. Express creates a call session and dispatches `my-agent`; this worker joins its room and retrieves the stored prompt snapshot through authenticated backend endpoints.

## Setup

Copy `.env.example` to `.env.local` and configure the same LiveKit URL, key, secret, `LIVEKIT_AGENT_NAME`, and `AGENT_SERVICE_SECRET` as the backend. `BACKEND_URL` defaults to `http://localhost:3001`; use HTTPS outside localhost. The service secret must contain at least 32 characters and must never be sent to the browser.

From this directory:

```sh
uv sync --locked
uv run --env-file .env.local lk agent dev --deployment voice-studio-local
```

Alternatively, run `npm run dev:agent` from the repository root. This loads `.env.local` before the LiveKit CLI checks credentials. The Python entrypoint's `load_dotenv()` runs too late to supply credentials to the CLI itself.

Run the Node app separately with `npm run dev` from the repository root. Set `LIVEKIT_AGENT_DEPLOYMENT=voice-studio-local` in both local environment files. Sign in, save an agent, and start Web Call. For production, use the production worker's deployment name on both backend and worker; worker startup is `uv run python src/agent.py start`. Node builds do not deploy the Python service.

The initial pipeline retains the starter's LiveKit Inference STT, LLM, TTS, turn handling, and ai-coustics enhancement. Plugins register at module startup before job execution; importing a plugin for the first time inside a job thread is unsupported by LiveKit.

## Verification

```sh
uv run ruff format --check
uv run ruff check
uv run python -m pytest -q
lk agent debugger start
lk agent debugger say "Hello, what can you help me with?"
lk agent debugger stop
lk agent simulate text --scenarios scenarios.yaml
```

Debugger/console mode uses an isolated fixture and accepts `AGENT_TEST_NAME` and `AGENT_TEST_PROMPT`. Simulations use the SDK simulation context and scenario `userdata`. Normal dispatched calls fail closed if metadata or backend context is missing; they never substitute a generic agent.

Offline tests require no provider credentials. Debugger and simulation runs use real inference. Repository-root GitHub workflows run offline checks and configured simulations; set the three LiveKit secrets in the `livekit` GitHub environment for simulations.

See [browser calls](../docs/web-calls.md) for endpoints, limits, cleanup behavior, and manual microphone/speaker verification. See [LiveKit documentation](https://docs.livekit.io/agents/) for SDK guidance.
