"""
Embedding generation via OpenAI text-embedding-3-small (1536 dims).
Returns None when OPENAI_API_KEY is not set; callers degrade gracefully.
"""
from ..config import get_settings

EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMS = 1536
MAX_CHARS = 32_000  # ~8k tokens


async def generate_embedding(text: str) -> list[float] | None:
    """Return 1536-dim embedding vector, or None if no key configured."""
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    text = text[:MAX_CHARS].replace('\n', ' ')
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(model=EMBEDDING_MODEL, input=text)
        return response.data[0].embedding
    except Exception:
        return None
