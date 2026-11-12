import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from agent import Assistant
from call_context import CallContext, Dispatch
from call_runtime import run_voice_call
from config import BackendConfig


def fixture():
    call_id = str(uuid4())
    dispatch = Dispatch(call_id, "voice-test")
    now = datetime.now(timezone.utc)
    data = {
        "callId": call_id,
        "roomName": "voice-test",
        "participantIdentity": "caller",
        "agentName": "Cedar Reception",
        "prompt": "Cedar Library opens at nine.",
        "joinDeadline": (now + timedelta(seconds=45)).isoformat(),
        "expiresAt": (now + timedelta(seconds=600)).isoformat(),
        "readyTimeoutSeconds": 30,
    }
    return dispatch, data


def test_context_rejects_room_mismatch_expiry_and_missing_instructions():
    dispatch, data = fixture()
    assert CallContext.parse(data, dispatch).agent_name == "Cedar Reception"
    for patch in [
        {"roomName": "other"},
        {"callId": str(uuid4())},
        {"prompt": ""},
        {"expiresAt": "2000-01-01T00:00:00Z"},
        {"joinDeadline": "2000-01-01T00:00:00Z"},
        {"readyTimeoutSeconds": True},
    ]:
        with pytest.raises(ValueError):
            CallContext.parse({**data, **patch}, dispatch)
    with pytest.raises(ValueError):
        Dispatch.parse(
            json.dumps({"version": 1, "callId": dispatch.call_id, "roomName": "other"}),
            "voice-test",
        )


def test_separate_agents_use_their_own_saved_prompts():
    receptionist = Assistant("Cedar", "Cedar Library opens at nine.")
    support = Assistant(
        "Harbor", "Unopened notebooks can be returned within fourteen days."
    )
    assert "Cedar Library" in receptionist.instructions
    assert "fourteen days" in support.instructions
    assert "Cedar Library" not in support.instructions
    assert "fourteen days" not in receptionist.instructions


def test_worker_config_rejects_remote_plain_http_and_missing_secret(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "http://remote.example")
    monkeypatch.setenv("AGENT_SERVICE_SECRET", "s" * 32)
    with pytest.raises(ValueError, match="HTTPS"):
        BackendConfig.read()
    monkeypatch.setenv("BACKEND_URL", "http://localhost:3001")
    monkeypatch.setenv("AGENT_SERVICE_SECRET", "")
    with pytest.raises(ValueError, match="32"):
        BackendConfig.read()


@pytest.mark.asyncio
async def test_missing_dispatch_never_loads_context_or_starts_generic_agent():
    invoked = []
    ctx = SimpleNamespace(
        job=SimpleNamespace(metadata="{}"), room=SimpleNamespace(name="voice-test")
    )
    backend = SimpleNamespace(context=lambda *_: invoked.append("context"))
    with pytest.raises(ValueError):
        await run_voice_call(
            ctx, backend, lambda: invoked.append("session"), lambda *_: None
        )
    assert not invoked


@pytest.mark.asyncio
async def test_context_failure_reports_failure_without_starting_session():
    dispatch, _ = fixture()
    events = []
    stopped = []

    async def bad_context(_):
        raise ValueError("unavailable")

    async def event(_dispatch, kind):
        events.append(kind)

    ctx = SimpleNamespace(
        job=SimpleNamespace(
            metadata=json.dumps(
                {
                    "version": 1,
                    "callId": dispatch.call_id,
                    "roomName": dispatch.room_name,
                }
            )
        ),
        room=SimpleNamespace(name=dispatch.room_name),
        add_shutdown_callback=lambda callback: None,
        shutdown=lambda **_: stopped.append(True),
    )
    await run_voice_call(
        ctx,
        SimpleNamespace(context=bad_context, event=event),
        lambda: pytest.fail("Must not start a session"),
        lambda *_: None,
    )
    assert events == ["failed"]
    assert stopped == [True]


@pytest.mark.asyncio
async def test_runtime_binds_expected_participant_and_reports_lifecycle(monkeypatch):
    from livekit.plugins import ai_coustics

    monkeypatch.setattr(ai_coustics, "audio_enhancement", lambda **_: None)
    dispatch, data = fixture()
    config = CallContext.parse(data, dispatch)
    events = []
    subscriptions = {}
    captured = {}

    class Session:
        def on(self, name, callback):
            subscriptions[name] = callback

        async def start(self, **kwargs):
            captured.update(kwargs)

        def generate_reply(self, **_):
            subscriptions["close"](SimpleNamespace(error=None))

        async def aclose(self):
            events.append("closed")

    async def connect():
        pass

    async def participant(**kwargs):
        assert kwargs == {"identity": "caller"}

    async def context(_):
        return config

    async def event(_dispatch, kind):
        events.append(kind)

    ctx = SimpleNamespace(
        job=SimpleNamespace(
            metadata=json.dumps(
                {
                    "version": 1,
                    "callId": dispatch.call_id,
                    "roomName": dispatch.room_name,
                }
            )
        ),
        room=SimpleNamespace(
            name=dispatch.room_name,
            remote_participants={"caller": object()},
            on=lambda *_: None,
        ),
        connect=connect,
        wait_for_participant=participant,
        add_shutdown_callback=lambda _: None,
        shutdown=lambda **_: events.append("shutdown"),
    )
    await asyncio.wait_for(
        run_voice_call(
            ctx,
            SimpleNamespace(context=context, event=event),
            Session,
            lambda name, prompt: (name, prompt),
        ),
        timeout=3,
    )
    assert captured["agent"] == ("Cedar Reception", "Cedar Library opens at nine.")
    assert captured["room_options"].participant_identity == "caller"
    assert events == ["ready", "active", "closed", "ended", "shutdown"]
