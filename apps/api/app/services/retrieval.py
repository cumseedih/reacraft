"""
Semantic retrieval via pgvector cosine similarity.
Falls back to recency ordering when no embedding is available (no API key,
pgvector absent, or embedding column is TEXT).

Both search_* functions return (contents, method) where method is either
'semantic' (cosine similarity was used and returned rows) or 'recency'
(fallback path).  This is the single source of truth so callers report the
method that was actually used.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from ..services.embeddings import generate_embedding

logger = logging.getLogger(__name__)

RetrievalResult = tuple[list[str], str]  # (contents, method)


async def search_memories(
    user_id: str,
    query: str,
    db: AsyncSession,
    limit: int = 5,
) -> RetrievalResult:
    """
    Return (contents, method) for up to `limit` memories most relevant to `query`.

    method is 'semantic' when cosine similarity was used and returned rows,
    'recency' otherwise.  Embedding generation is performed exactly once.
    """
    embedding = await generate_embedding(query)

    if embedding:
        try:
            vec_str = '[' + ','.join(str(x) for x in embedding) + ']'
            sql = text(
                "SELECT content FROM memories "
                "WHERE user_id = :uid AND embedding IS NOT NULL "
                "ORDER BY embedding <=> CAST(:vec AS vector) "
                "LIMIT :lim"
            )
            result = await db.execute(sql, {'uid': user_id, 'vec': vec_str, 'lim': limit})
            rows = result.fetchall()
            if rows:
                logger.debug('Semantic memory search: %d results for user %s', len(rows), user_id)
                return ([r[0] for r in rows], 'semantic')
        except Exception as exc:
            logger.warning('Semantic memory search failed (%s), falling back to recency', exc)

    # Fallback: recency ordering
    from ..models.memory import Memory
    result = await db.execute(
        select(Memory.content)
        .where(Memory.user_id == user_id)
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    return (list(result.scalars().all()), 'recency')


async def search_document_chunks(
    project_id: str,
    query: str,
    db: AsyncSession,
    limit: int = 5,
) -> RetrievalResult:
    """
    Return (contents, method) for up to `limit` document chunks most relevant to `query`.

    method is 'semantic' when cosine similarity was used and returned rows,
    'recency' otherwise.  Embedding generation is performed exactly once.
    """
    embedding = await generate_embedding(query)

    if embedding:
        try:
            vec_str = '[' + ','.join(str(x) for x in embedding) + ']'
            sql = text(
                "SELECT dc.content FROM document_chunks dc "
                "JOIN project_files pf ON pf.id = dc.file_id "
                "WHERE pf.project_id = :pid AND dc.embedding IS NOT NULL "
                "ORDER BY dc.embedding <=> CAST(:vec AS vector) "
                "LIMIT :lim"
            )
            result = await db.execute(sql, {'pid': project_id, 'vec': vec_str, 'lim': limit})
            rows = result.fetchall()
            if rows:
                logger.debug('Semantic doc search: %d chunks for project %s', len(rows), project_id)
                return ([r[0] for r in rows], 'semantic')
        except Exception as exc:
            logger.warning('Semantic doc search failed (%s), falling back to recency', exc)

    # Fallback: recency order (no embedding available)
    from ..models.project import DocumentChunk, ProjectFile
    result = await db.execute(
        select(DocumentChunk.content)
        .join(ProjectFile, ProjectFile.id == DocumentChunk.file_id)
        .where(ProjectFile.project_id == project_id)
        .order_by(DocumentChunk.created_at.desc())
        .limit(limit)
    )
    return (list(result.scalars().all()), 'recency')


def build_memory_context(contents: list[str]) -> str:
    if not contents:
        return ''
    return 'User context:\n' + '\n'.join(f'- {c}' for c in contents)


def build_rag_context(contents: list[str]) -> str:
    if not contents:
        return ''
    return 'Relevant documents:\n' + '\n---\n'.join(contents)
