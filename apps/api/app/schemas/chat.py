from pydantic import BaseModel
from typing import Any


class StreamRequest(BaseModel):
    message: str
    model: str = 'kroex-pro'
    conversation_id: str | None = None
    project_id: str | None = None
    messages: list[dict[str, Any]] = []


class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True
