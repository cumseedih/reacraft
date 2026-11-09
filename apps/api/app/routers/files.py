"""
File upload endpoint for project documents.
Supported types: .txt, .md, .pdf, .docx (up to MAX_UPLOAD_SIZE_MB).
Text extraction and embedding happen in a BackgroundTask after the
HTTP response is returned, so upload is always fast.
"""
import os
import uuid
from datetime import datetime
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User
from ..models.project import Project, ProjectFile, DocumentChunk
from ..utils.auth import get_current_user
from ..services.document import extract_text, chunk_text, EXTENSION_TO_CONTENT_TYPE
from ..services.embeddings import generate_embedding
from ..config import get_settings

router = APIRouter(prefix='/api/projects', tags=['files'])


class FileOut(BaseModel):
    id: str
    name: str
    content_type: str
    size: int
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


async def _process_document(file_id: str, file_path: str, content_type: str) -> None:
    """Background: extract text, chunk, embed, persist."""
    from ..database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(ProjectFile).where(ProjectFile.id == file_id))
            pfile = result.scalar_one_or_none()
            if not pfile:
                return

            text = await extract_text(file_path, content_type)
            if not text:
                return

            pfile.extracted_text = text
            chunks = chunk_text(text)

            for idx, chunk in enumerate(chunks):
                embedding = await generate_embedding(chunk)
                db.add(DocumentChunk(
                    id=str(uuid.uuid4()),
                    file_id=file_id,
                    chunk_index=idx,
                    content=chunk,
                    embedding=embedding,
                ))

            pfile.chunk_count = len(chunks)
            await db.commit()
        except Exception:
            await db.rollback()


@router.post('/{project_id}/files', response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')

    ext = os.path.splitext(file.filename or '')[1].lower()
    content_type = EXTENSION_TO_CONTENT_TYPE.get(ext)
    if not content_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Unsupported file type. Allowed: {", ".join(EXTENSION_TO_CONTENT_TYPE.keys())}',
        )

    data = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f'File exceeds {settings.max_upload_size_mb}MB limit',
        )

    file_id = str(uuid.uuid4())
    storage_key = f'{project_id}/{file_id}{ext}'
    file_path = os.path.join(settings.upload_dir, storage_key)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    async with aiofiles.open(file_path, 'wb') as f_out:
        await f_out.write(data)

    pfile = ProjectFile(
        id=file_id,
        project_id=project_id,
        name=file.filename or f'upload{ext}',
        content_type=content_type,
        size=len(data),
        storage_key=storage_key,
        chunk_count=0,
    )
    db.add(pfile)
    await db.flush()

    background_tasks.add_task(_process_document, file_id, file_path, content_type)
    return FileOut.model_validate(pfile)


@router.get('/{project_id}/files', response_model=list[FileOut])
async def list_files(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')

    files = await db.execute(
        select(ProjectFile).where(ProjectFile.project_id == project_id)
    )
    return [FileOut.model_validate(f) for f in files.scalars().all()]


@router.delete('/{project_id}/files/{file_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    project_id: str,
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')

    result = await db.execute(
        select(ProjectFile).where(
            ProjectFile.id == file_id, ProjectFile.project_id == project_id
        )
    )
    pfile = result.scalar_one_or_none()
    if not pfile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='File not found')

    settings = get_settings()
    file_path = os.path.join(settings.upload_dir, pfile.storage_key)
    try:
        os.remove(file_path)
    except OSError:
        pass

    await db.delete(pfile)
