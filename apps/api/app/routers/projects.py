from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..database import get_db
from ..models.user import User
from ..models.project import Project, ProjectFile
from ..utils.auth import get_current_user
import uuid

router = APIRouter(prefix='/api/projects', tags=['projects'])

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    system_prompt: str | None = None
    color: str | None = None
    icon: str | None = None

class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    system_prompt: str | None
    color: str | None
    icon: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

@router.get('', response_model=list[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )
    return [ProjectOut.model_validate(p) for p in result.scalars().all()]

@router.post('', response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        color=payload.color,
        icon=payload.icon,
    )
    db.add(project)
    await db.flush()
    return ProjectOut.model_validate(project)

@router.delete('/{project_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
    await db.delete(project)
