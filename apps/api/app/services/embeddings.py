"""
Embedding generation via OpenAI text-embedding-3-small (1536 dims).
Returns None when OPENAI_API_KEY is not set; callers degrade gracefully.
"""
import logging
from ..config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMS = 1536
MAX_CHARS = 32_000  # ~8k tokens


async def generate_embedding(text: str) -> list[float] | None:
    """Return 1536-dim embedding vector, or None if no key configured."""
    settings = get_settings()
    if not settings.openai_api_key:
        logger.debug('OPENAI_API_KEY not set; skipping embedding generation')
        return None
    text = text[:MAX_CHARS].replace('\n', ' ')
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(model=EMBEDDING_MODEL, input=text)
        logger.debug('Generated embedding: %d dims for %d chars', EMBEDDING_DIMS, len(text))
        return response.data[0].embedding
    except Exception as exc:
        logger.warning('Embedding generation failed: %s', exc)
        return None
