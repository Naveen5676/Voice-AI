import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    STTContextOptions,
    TurnHandlingOptions,
    cli,
    inference,
)
from livekit.agents.llm import function_tool

from backend_client import BackendClient
from call_context import voice_instructions
from call_runtime import run_voice_call
from config import BackendConfig
from kb_client import search_knowledge_base

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv()
logger = logging.getLogger("agent")


def make_kb_tool(kb_id: str):
    @function_tool
    async def query_knowledge_base(query: str) -> str:
        """Query the knowledge base for company policies, rules, pricing, or documentation when the user asks."""
        logger.info(f"Dynamic KB Tool called for kb_id '{kb_id}': query='{query}'")
        return await search_knowledge_base(kb_id, query)

    return query_knowledge_base


class Assistant(Agent):
    def __init__(self, name: str, prompt: str, kb_id: str = "") -> None:
        self.kb_id = kb_id
        tools = [make_kb_tool(kb_id)] if kb_id else []
        super().__init__(
            llm=inference.LLM(model="google/gemma-4-31b-it"),
            instructions=voice_instructions(name, prompt, has_kb=bool(kb_id)),
            tools=tools,
        )


def create_session() -> AgentSession:
    return AgentSession(
        stt=inference.STT(model="assemblyai/universal-3-6-pro", language="en"),
        stt_context_options=STTContextOptions(
            keyterms=["LiveKit"],
            keyterm_detection={"enabled": True},
        ),
        tts=inference.TTS(
            model="fishaudio/s2.1-pro", voice="fa4c9eb3dccc4806b382b40d61c6b10a"
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
            interruption={"mode": "adaptive"},
            preemptive_generation={"enabled": True},
        ),
        expressive=True,
    )


job_executor = os.environ.get("JOB_EXECUTOR_TYPE", "thread")
num_idle = int(os.environ.get("NUM_IDLE_PROCESSES", "0"))
load_threshold = float(os.environ.get("LOAD_THRESHOLD", "3.0"))

server = AgentServer(
    job_executor_type=job_executor,
    num_idle_processes=num_idle,
    load_threshold=load_threshold,
)


@server.rtc_session(agent_name=os.environ.get("LIVEKIT_AGENT_NAME", "my-agent"))
async def my_agent(ctx: JobContext):
    logger.info(f"[AgentWorker] Received incoming job for room: {ctx.room.name}")
    ctx.log_context_fields = {"room": ctx.room.name}
    # Fixtures are accepted only in SDK simulation jobs or local console startup.
    # Missing production dispatch metadata never selects the generic assistant.
    simulation = ctx.simulation_context()
    if simulation is not None or "console" in sys.argv:
        fixture = simulation.userdata() if simulation else {}
        name = fixture.get(
            "agent_name", os.environ.get("AGENT_TEST_NAME", "Voice assistant")
        )
        prompt = fixture.get(
            "prompt",
            os.environ.get(
                "AGENT_TEST_PROMPT",
                "You are a friendly voice assistant. Be concise and honest. Do not invent personal facts or help with harmful requests.",
            ),
        )
        session = create_session()
        await session.start(agent=Assistant(name, prompt), room=ctx.room)
        await ctx.connect()
        return
    try:
        async with BackendClient(BackendConfig.read()) as backend:
            await run_voice_call(ctx, backend, create_session, Assistant)
    except Exception:
        logger.error("Voice job configuration is invalid; refusing to start")
        ctx.shutdown(reason="invalid voice job configuration")


def start_health_server():
    port_str = os.environ.get("PORT", "8080")
    if not port_str:
        return
    try:
        port = int(port_str)
    except ValueError:
        return

    from http.server import BaseHTTPRequestHandler, HTTPServer
    import threading

    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")

        def do_HEAD(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, format, *args):
            pass

    httpd = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Health check server listening on port {port}")


if __name__ == "__main__":
    start_health_server()
    cli.run_app(server)
