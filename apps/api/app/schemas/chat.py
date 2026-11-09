from pydantic import BaseModel
from typing import Literal

class MessageIn(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class StreamRequest(BaseModel):
    messages: list[MessageIn]
    model: str = 'kroex-pro'
    conversation_id: str | None = None
    system_prompt: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096

class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    pinned: bool
    archived: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    model: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    feedback: str | None = None
    created_at: str

    class Config:
        from_attributes = True
