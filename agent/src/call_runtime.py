"""One room's lifecycle. No mutable state is shared between jobs."""

import asyncio
import logging
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from traceback import extract_tb

from livekit.agents import room_io

from call_context import Dispatch

logger = logging.getLogger("agent")


async def run_voice_call(ctx, backend, make_session, make_assistant):
    dispatch = Dispatch.parse(ctx.job.metadata, ctx.room.name)
    session = None
    grace = None
    done = asyncio.Event()
    failed = False
    stage = "context"

    async def report(event_type):
        try:
            await backend.event(dispatch, event_type)
        except Exception:
            logger.warning(
                "Worker event delivery failed", extra={"call_id": dispatch.call_id}
            )

    async def shutdown():
        done.set()

    ctx.add_shutdown_callback(shutdown)
    try:
        config = await backend.context(dispatch)
        stage = "connect"
        await asyncio.wait_for(ctx.connect(), timeout=10)
        stage = "participant"
        remaining = (config.join_deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            raise TimeoutError("Join deadline exceeded")
        await asyncio.wait_for(
            ctx.wait_for_participant(identity=config.participant_identity),
            timeout=remaining,
        )

        async def disconnect_grace():
            await asyncio.sleep(10)
            if config.participant_identity not in ctx.room.remote_participants:
                done.set()

        def participant_left(participant):
            nonlocal grace
            if participant.identity == config.participant_identity:
                if grace:
                    grace.cancel()
                grace = asyncio.create_task(disconnect_grace())

        def participant_joined(participant):
            if participant.identity == config.participant_identity and grace:
                grace.cancel()

        def room_disconnected(*_args):
            done.set()

        ctx.room.on("participant_disconnected", participant_left)
        ctx.room.on("participant_connected", participant_joined)
        ctx.room.on("disconnected", room_disconnected)
        stage = "pipeline"
        session = make_session()

        def session_closed(event):
            nonlocal failed
            failed = event.error is not None
            done.set()

        session.on("close", session_closed)
        stage = "session_start"
        await asyncio.wait_for(
            session.start(
                agent=make_assistant(config.agent_name, config.prompt),
                room=ctx.room,
                room_options=room_io.RoomOptions(
                    participant_identity=config.participant_identity,
                    close_on_disconnect=False,
                ),
            ),
            timeout=min(
                config.ready_timeout,
                max(
                    0.1,
                    (config.expires_at - datetime.now(timezone.utc)).total_seconds(),
                ),
            ),
        )
        # Cover a disconnect that occurred while session.start was pending.
        if config.participant_identity not in ctx.room.remote_participants:
            grace = asyncio.create_task(disconnect_grace())
        await report("ready")
        await report("active")
        session.generate_reply(
            instructions="Briefly introduce yourself using your configured role and ask how you can help."
        )
        remaining = (config.expires_at - datetime.now(timezone.utc)).total_seconds()
        if remaining > 0:
            with suppress(TimeoutError):
                await asyncio.wait_for(done.wait(), timeout=remaining)
    except asyncio.CancelledError:
        raise
    except Exception as error:
        failed = True
        logger.error(
            "Voice call failed",
            extra={
                "call_id": dispatch.call_id,
                "stage": stage,
                "error_type": type(error).__name__,
                "frames": [
                    f"{Path(frame.filename).name}:{frame.lineno}"
                    for frame in extract_tb(error.__traceback__)
                ],
            },
        )
    finally:
        if grace:
            grace.cancel()
            await asyncio.gather(grace, return_exceptions=True)
        if session:
            try:
                await asyncio.wait_for(session.aclose(), timeout=5)
            except Exception:
                logger.warning("Voice session cleanup exceeded its deadline")
        await report("failed" if failed else "ended")
        ctx.shutdown(reason="voice call complete")
