import logging
import os

import aiohttp

logger = logging.getLogger("agent.kb_client")

VECTOR_SERVICE_URL = os.environ.get("VECTOR_SERVICE_URL", "http://127.0.0.1:8010")


async def search_knowledge_base(kb_id: str, query: str, top_k: int = 3) -> str:
    """Query the local Vector Service for relevant chunks matching the caller's query."""
    if not kb_id or not query.strip():
        return "No knowledge base query provided."

    url = f"{VECTOR_SERVICE_URL}/search"
    payload = {
        "query": query.strip(),
        "kb_id": kb_id,
        "top_k": top_k,
    }

    try:
        async with (
            aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=4)) as session,
            session.post(url, json=payload) as response,
        ):
            if response.status == 200:
                data = await response.json()
                chunks: list[str] = data.get("chunks", [])
                if chunks:
                    logger.info(f"Retrieved {len(chunks)} KB chunks for query: '{query}'")
                    formatted = "\n\n".join([f"- {chunk}" for chunk in chunks])
                    return f"Found relevant information:\n{formatted}"
                return "No specific information found in the knowledge base."
            else:
                logger.warning(f"Vector search returned HTTP {response.status}")
                return "Knowledge base search is temporarily unavailable."
    except Exception as e:
        logger.warning(f"Could not connect to vector service at {url}: {e}")
        return "Knowledge base search could not be completed."
