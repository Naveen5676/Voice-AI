import asyncio
from uuid import uuid4

import aiohttp

from call_context import CallContext, Dispatch
from config import BackendConfig


class BackendClient:
    def __init__(self, config: BackendConfig):
        self._config = config
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=8),
            headers={"Authorization": f"Bearer {self._config.secret}"},
            raise_for_status=True,
        )
        return self

    async def __aexit__(self, *_args):
        if self._session:
            await self._session.close()

    async def context(self, dispatch: Dispatch) -> CallContext:
        assert self._session is not None
        url = f"{self._config.url}/api/internal/web-calls/{dispatch.call_id}/context"
        async with self._session.get(
            url, params={"roomName": dispatch.room_name}, allow_redirects=False
        ) as response:
            if response.status != 200:
                raise ValueError("Call context is unavailable")
            return CallContext.parse(await response.json(), dispatch)

    async def event(self, dispatch: Dispatch, event_type: str):
        assert self._session is not None
        url = f"{self._config.url}/api/internal/web-calls/{dispatch.call_id}/events"
        payload = {
            "eventId": str(uuid4()),
            "roomName": dispatch.room_name,
            "type": event_type,
        }
        # Reuse the same event ID when a response is lost.
        for attempt in range(2):
            try:
                async with self._session.post(
                    url, json=payload, allow_redirects=False
                ) as response:
                    if response.status != 204:
                        raise ValueError("Worker event was not accepted")
                return
            except (aiohttp.ClientError, TimeoutError):
                if attempt:
                    raise
                await asyncio.sleep(0.25)
