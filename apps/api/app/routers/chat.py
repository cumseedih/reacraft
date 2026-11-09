from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message
from ..schemas.chat import StreamRequest, ConversationOut, MessageOut
from ..services.ai import stream_chat
from ..utils.auth import get_current_user
import uuid

router = APIRouter(prefix='/api', tags=['chat'])

@router.post('/chat/stream')
async def chat_stream(
    payload: StreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    messages = [{'role': m.role, 'content': m.content} for m in payload.messages]

    async def generate():
        full_response = []
        async for chunk in stream_chat(
            messages=messages,
            model_id=payload.model,
            system_prompt=payload.system_prompt,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        ):
            if chunk.startswith('data: '):
                import json
                try:
                    data = json.loads(chunk[6:])
                    if data.get('type') == 'delta':
                        full_response.append(data.get('text', ''))
                except Exception:
                    pass
            yield chunk

        try:
            conv_id = payload.conversation_id or str(uuid.uuid4())
            result = await db.execute(
                select(Conversation).where(
                    Conversation.id == conv_id,
                    Conversation.user_id == current_user.id,
                )
            )
            conv = result.scalar_one_or_none()
            if not conv:
                conv = Conversation(id=conv_id, user_id=current_user.id, model=payload.model)
                db.add(conv)

            for m in payload.messages:
                db.add(Message(
                    conversation_id=conv_id,
                    role=m.role,
                    content=m.content,
                ))
            db.add(Message(
                conversation_id=conv_id,
                role='assistant',
                content=''.join(full_response),
                model=payload.model,
            ))
            await db.commit()
        except Exception:
            pass

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={'X-Accel-Buffering': 'no'},
    )

@router.get('/conversations', response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id, Conversation.archived == False)
        .order_by(Conversation.updated_at.desc())
    )
    return [ConversationOut.model_validate(c) for c in result.scalars().all()]

@router.get('/conversations/{conv_id}/messages', response_model=list[MessageOut])
async def list_messages(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Conversation not found')

    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    return [MessageOut.model_validate(m) for m in msgs.scalars().all()]

@router.delete('/conversations/{conv_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Conversation not found')
    await db.delete(conv)
