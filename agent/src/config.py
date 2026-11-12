import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class BackendConfig:
    url: str
    secret: str

    @classmethod
    def read(cls) -> "BackendConfig":
        url = os.environ.get("BACKEND_URL", "http://localhost:3001").rstrip("/")
        parsed = urlparse(url)
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Invalid BACKEND_URL")
        if parsed.scheme != "https" and not (
            parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise ValueError("BACKEND_URL must use HTTPS outside localhost")
        if not parsed.hostname:
            raise ValueError("BACKEND_URL is missing a host")
        secret = os.environ.get("AGENT_SERVICE_SECRET", "")
        if len(secret) < 32:
            raise ValueError("AGENT_SERVICE_SECRET must contain at least 32 characters")
        return cls(url=url, secret=secret)
