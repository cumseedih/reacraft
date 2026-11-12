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
from ..services.ai import stream_chat
from ..services.retrieval import search_memories, search_document_chunks, build_memory_context, build_rag_context
from ..utils.auth import get_current_user

router = APIRouter(prefix='/api', tags=['chat'])

ARTIFACT_RE = re.compile(r'```(\w+)?\n([\s\S]+?)```', re.MULTILINE)


def _extract_code_artifacts(response_text: str) -> list[dict]:
    """Parse code blocks from AI response text."""
    artifacts = []
    for match in ARTIFACT_RE.finditer(response_text):
        language = match.group(1) or ''
        content = match.group(2).strip()
        if not content:
            continue
        title = f'{language.capitalize()} snippet' if language else 'Code snippet'
        artifacts.append({'title': title, 'type': 'code', 'language': language, 'content': content})
    return artifacts


@router.post('/chat/stream')
async def stream_chat_endpoint(
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

    # Build context additions (each returns (contents, method); method logged but not surfaced)
    memory_contents, _ = await search_memories(current_user.id, request.message, db)
    memory_ctx = build_memory_context(memory_contents)
    rag_ctx = ''
    if request.project_id:
        doc_contents, _ = await search_document_chunks(request.project_id, request.message, db)
        rag_ctx = build_rag_context(doc_contents)

    system_parts = []
    if memory_ctx:
        system_parts.append(memory_ctx)
    if rag_ctx:
        system_parts.append(rag_ctx)
    extra_system = '\n\n'.join(system_parts) or None

    # Persist user message and commit so the streaming generator can reference conv_id
    # via a separate session (FK requires the conversation to be committed first).
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role='user',
        content=request.message,
    )
    db.add(user_msg)
    await db.commit()

    conv_id = conversation.id
    user_id = current_user.id
    messages = request.messages + [{'role': 'user', 'content': request.message}]

    async def generate():
        full_response_parts: list[str] = []
        try:
            async for sse_line in stream_chat(
                messages=messages,
                model_id=request.model,
                system_prompt=extra_system,
            ):
                # sse_line is already "data: {...}\n\n"; also collect text
                if sse_line.startswith('data: '):
                    try:
                        payload = json.loads(sse_line[6:].strip())
                        if payload.get('type') == 'delta':
                            full_response_parts.append(payload.get('text', ''))
                    except Exception:
                        pass
                yield sse_line
        except Exception as exc:
            yield f'data: {json.dumps({"type": "error", "message": str(exc)})}\n\n'
            return

        response_text = ''.join(full_response_parts)

        # Persist assistant message and artifacts out-of-band
        try:
            from ..database import AsyncSessionLocal
            async with AsyncSessionLocal() as persist_db:
                asst_msg = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conv_id,
                    role='assistant',
                    content=response_text,
                )
                persist_db.add(asst_msg)

                for art_data in _extract_code_artifacts(response_text):
                    art_id = str(uuid.uuid4())
                    artifact = Artifact(
                        id=art_id,
                        conversation_id=conv_id,
                        user_id=user_id,
                        title=art_data['title'],
                        type=art_data['type'],
                        language=art_data['language'] or None,
                        content=art_data['content'],
                    )
                    persist_db.add(artifact)
                    yield f'data: {json.dumps({"type": "artifact", "artifact": {"id": art_id, **art_data}})}\n\n'

                await persist_db.commit()
        except Exception:
            pass

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Conversation-Id': conv_id},
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
