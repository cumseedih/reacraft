"""
User-controlled persistent memory.
Stores plain-text facts per user; retrieves semantically via pgvector.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..database import get_db
from ..models.user import User
from ..models.memory import Memory
from ..utils.auth import get_current_user
from ..services.embeddings import generate_embedding

router = APIRouter(prefix='/api/memory', tags=['memory'])


class MemoryCreate(BaseModel):
    content: str
    source: str = 'user'


class MemoryOut(BaseModel):
    id: str
    content: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


async def _embed_memory(memory_id: str) -> None:
    from ..database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Memory).where(Memory.id == memory_id))
            mem = result.scalar_one_or_none()
            if not mem:
                return
            embedding = await generate_embedding(mem.content)
            if embedding:
                mem.embedding = embedding
                await db.commit()
        except Exception:
            await db.rollback()


@router.get('', response_model=list[MemoryOut])
async def list_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
        .limit(200)
    )
    return [MemoryOut.model_validate(m) for m in result.scalars().all()]


@router.post('', response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.content.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Content is required')

    mem = Memory(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        content=body.content.strip(),
        source=body.source,
    )
    db.add(mem)
    await db.flush()
    background_tasks.add_task(_embed_memory, mem.id)
    return MemoryOut.model_validate(mem)


@router.delete('/{memory_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == current_user.id)
    )
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Memory not found')
    await db.delete(mem)
