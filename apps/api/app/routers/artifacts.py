"""
Artifact persistence — read and delete code artifacts extracted from chat.
Artifacts are created by the chat router; this router exposes them for retrieval.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User
from ..models.artifact import Artifact
from ..utils.auth import get_current_user

router = APIRouter(prefix='/api/artifacts', tags=['artifacts'])


class ArtifactOut(BaseModel):
    id: str
    conversation_id: str
    title: str
    type: str
    language: str | None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get('', response_model=list[ArtifactOut])
async def list_artifacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Artifact)
        .where(Artifact.user_id == current_user.id)
        .order_by(Artifact.created_at.desc())
        .limit(100)
    )
    return [ArtifactOut.model_validate(a) for a in result.scalars().all()]


@router.get('/conversation/{conversation_id}', response_model=list[ArtifactOut])
async def list_conversation_artifacts(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Artifact)
        .where(
            Artifact.conversation_id == conversation_id,
            Artifact.user_id == current_user.id,
        )
        .order_by(Artifact.created_at.asc())
    )
    return [ArtifactOut.model_validate(a) for a in result.scalars().all()]


@router.delete('/{artifact_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id, Artifact.user_id == current_user.id
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Artifact not found')
    await db.delete(artifact)
