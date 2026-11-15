import logging
import os
from pathlib import Path
from typing import List, Optional

import chromadb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vector_service")

DB_DIR = Path(__file__).resolve().parent / "storage"
DB_DIR.mkdir(parents=True, exist_ok=True)

logger.info(f"Initializing persistent ChromaDB vector store at: {DB_DIR}")
chroma_client = chromadb.PersistentClient(path=str(DB_DIR))
collection = chroma_client.get_or_create_collection(
    name="kb_notes",
    metadata={"hnsw:space": "cosine"}
)

app = FastAPI(title="Voice Studio Vector Service", version="1.0.0")


class IndexTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    item_id: str
    kb_id: Optional[str] = None
    agent_id: Optional[str] = None

    def target_id(self) -> str:
        return self.kb_id or self.agent_id or ""


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    kb_id: Optional[str] = None
    agent_id: Optional[str] = None
    top_k: Optional[int] = Field(default=3, ge=1, le=10)

    def target_id(self) -> str:
        return self.kb_id or self.agent_id or ""


class DeleteRequest(BaseModel):
    item_id: Optional[str] = None
    kb_id: Optional[str] = None
    agent_id: Optional[str] = None


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 80) -> List[str]:
    """Split long text into overlapping chunks, prioritizing paragraphs and sentences."""
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return [text.strip()] if text.strip() else []

    chunks = []
    current_chunk = ""
    for para in paragraphs:
        if len(current_chunk) + len(para) + 1 <= chunk_size:
            current_chunk = f"{current_chunk}\n{para}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(para) > chunk_size:
                words = para.split(" ")
                temp = ""
                for word in words:
                    if len(temp) + len(word) + 1 <= chunk_size:
                        temp = f"{temp} {word}".strip()
                    else:
                        if temp:
                            chunks.append(temp)
                        temp = word
                current_chunk = temp
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    return chunks or [text.strip()]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "vector-service",
        "total_chunks": collection.count(),
        "storage": str(DB_DIR),
    }


@app.post("/index-text")
def index_text(request: IndexTextRequest):
    try:
        # Delete any existing chunks for this item_id before re-indexing
        try:
            collection.delete(where={"item_id": request.item_id})
        except Exception:
            pass

        chunks = chunk_text(request.text)
        if not chunks:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        target = request.target_id()
        ids = [f"{request.item_id}_{idx}" for idx in range(len(chunks))]
        metadatas = [
            {"kb_id": target, "item_id": request.item_id, "chunk_index": idx}
            for idx in range(len(chunks))
        ]

        collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )

        logger.info(f"Indexed {len(chunks)} chunks for item_id={request.item_id}, kb_id={target}")
        return {
            "status": "ok",
            "item_id": request.item_id,
            "kb_id": target,
            "chunks_indexed": len(chunks)
        }
    except Exception as e:
        logger.error(f"Failed to index text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search(request: SearchRequest):
    try:
        total = collection.count()
        if total == 0:
            return {"chunks": []}

        target = request.target_id()
        results = collection.query(
            query_texts=[request.query],
            n_results=min(request.top_k or 3, total),
            where={"kb_id": target} if target else None
        )

        documents = results.get("documents", [[]])[0]
        logger.info(f"Search for kb_id={target}, query='{request.query}' -> found {len(documents)} chunks")
        return {"chunks": documents}
    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        return {"chunks": []}


@app.delete("/delete")
def delete_vectors(request: DeleteRequest):
    target = request.kb_id or request.agent_id
    if not request.item_id and not target:
        raise HTTPException(status_code=400, detail="Either item_id or kb_id must be provided")

    where = {}
    if request.item_id:
        where["item_id"] = request.item_id
    if target:
        where["kb_id"] = target

    try:
        collection.delete(where=where)
        logger.info(f"Deleted vectors where {where}")
        return {"status": "ok", "deleted_where": where}
    except Exception as e:
        logger.error(f"Delete vectors error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
