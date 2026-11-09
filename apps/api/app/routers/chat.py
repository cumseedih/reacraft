"""
Chat streaming endpoint.
Injects user memories and RAG context from project documents,
then streams AI responses via SSE, extracting code artifacts.
"""
import json
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message
from ..models.memory import Memory
from ..models.artifact import Artifact
from ..models.project import DocumentChunk
from ..schemas.chat import StreamRequest, ConversationOut, MessageOut
from ..services.ai import stream_ai_response
from ..services.embeddings import generate_embedding
from ..utils.auth import get_current_user

router = APIRouter(prefix='/api', tags=['chat'])

ARTIFACT_RE = re.compile(r'```(\w+)?\n([\s\S]+?)```', re.MULTILINE)


async def _get_memory_context(user_id: str, query: str, db: AsyncSession, limit: int = 5) -> str:
    """Return top-k memories semantically closest to the query."""
    embedding = await generate_embedding(query)
    if not embedding:
        result = await db.execute(
            select(Memory.content)
            .where(Memory.user_id == user_id)
            .order_by(Memory.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()
        if not rows:
            return ''
        return 'User context:\n' + '\n'.join(f'- {r}' for r in rows)

    vec = str(embedding)
    sql = text(
        "SELECT content FROM memories "
        "WHERE user_id = :uid "
        "ORDER BY embedding <=> CAST(:vec AS vector) "
        "LIMIT :lim"
    )
    result = await db.execute(sql, {'uid': user_id, 'vec': vec, 'lim': limit})
    rows = result.fetchall()
    if not rows:
        return ''
    return 'User context:\n' + '\n'.join(f'- {r[0]}' for r in rows)


async def _get_rag_context(project_id: str, query: str, db: AsyncSession, limit: int = 5) -> str:
    """Return top-k document chunks closest to the query for the given project."""
    embedding = await generate_embedding(query)
    if not embedding:
        return ''
    vec = str(embedding)
    sql = text(
        "SELECT dc.content FROM document_chunks dc "
        "JOIN project_files pf ON pf.id = dc.file_id "
        "WHERE pf.project_id = :pid "
        "ORDER BY dc.embedding <=> CAST(:vec AS vector) "
        "LIMIT :lim"
    )
    result = await db.execute(sql, {'pid': project_id, 'vec': vec, 'lim': limit})
    rows = result.fetchall()
    if not rows:
        return ''
    return 'Relevant documents:\n' + '\n---\n'.join(r[0] for r in rows)


def _extract_code_artifacts(text: str) -> list[dict]:
    """Parse code blocks from AI response text."""
    artifacts = []
    for match in ARTIFACT_RE.finditer(text):
        language = match.group(1) or ''
        content = match.group(2).strip()
        if not content:
            continue
        title = f'{language.capitalize()} snippet' if language else 'Code snippet'
        artifacts.append({'title': title, 'type': 'code', 'language': language, 'content': content})
    return artifacts


@router.post('/chat/stream')
async def stream_chat(
    request: StreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Load or create conversation
    conversation = None
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Conversation not found')

    if not conversation:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=request.message[:60],
            model=request.model,
        )
        db.add(conversation)
        await db.flush()

    # Build context additions
    memory_ctx = await _get_memory_context(current_user.id, request.message, db)
    rag_ctx = ''
    if request.project_id:
        rag_ctx = await _get_rag_context(request.project_id, request.message, db)

    system_parts = []
    if memory_ctx:
        system_parts.append(memory_ctx)
    if rag_ctx:
        system_parts.append(rag_ctx)
    extra_system = '\n\n'.join(system_parts)

    # Persist user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role='user',
        content=request.message,
    )
    db.add(user_msg)
    await db.flush()

    async def generate():
        full_response = []
        try:
            async for chunk in stream_ai_response(
                model=request.model,
                messages=request.messages + [{'role': 'user', 'content': request.message}],
                system=extra_system if extra_system else None,
            ):
                full_response.append(chunk.get('text', ''))
                yield f'data: {json.dumps(chunk)}\n\n'
        except Exception as exc:
            yield f'data: {json.dumps({"type": "error", "message": str(exc)})}\n\n'
            return

        response_text = ''.join(full_response)

        # Persist assistant message and artifacts
        try:
            asst_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation.id,
                role='assistant',
                content=response_text,
            )
            db.add(asst_msg)

            for art_data in _extract_code_artifacts(response_text):
                art_id = str(uuid.uuid4())
                artifact = Artifact(
                    id=art_id,
                    conversation_id=conversation.id,
                    user_id=current_user.id,
                    title=art_data['title'],
                    type=art_data['type'],
                    language=art_data['language'] or None,
                    content=art_data['content'],
                )
                db.add(artifact)
                yield f'data: {json.dumps({"type": "artifact", "artifact": {"id": art_id, **art_data}})}\n\n'

            await db.commit()
        except Exception:
            await db.rollback()

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Conversation-Id': conversation.id},
    )


@router.get('/conversations', response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    return [ConversationOut.model_validate(c) for c in result.scalars().all()]


@router.get('/conversations/{conversation_id}/messages', response_model=list[MessageOut])
async def get_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Conversation not found')

    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return [MessageOut.model_validate(m) for m in msgs.scalars().all()]
