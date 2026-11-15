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


server = AgentServer()


@server.rtc_session(agent_name=os.environ.get("LIVEKIT_AGENT_NAME", "my-agent"))
async def my_agent(ctx: JobContext):
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


if __name__ == "__main__":
    cli.run_app(server)
