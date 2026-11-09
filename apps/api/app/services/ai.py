"""
AI service: routes model IDs to providers and streams responses.
API keys are loaded server-side from environment — never exposed to clients.
"""
import json
from collections.abc import AsyncGenerator
from ..config import get_settings

settings = get_settings()

MODEL_MAP: dict[str, dict] = {
    'kroex-ultra':  {'provider': 'anthropic', 'model': 'claude-opus-4-5'},
    'kroex-pro':    {'provider': 'anthropic', 'model': 'claude-sonnet-4-6'},
    'kroex-fast':   {'provider': 'anthropic', 'model': 'claude-haiku-4-5'},
    'gpt-4o':       {'provider': 'openai',    'model': 'gpt-4o'},
    'gpt-4o-mini':  {'provider': 'openai',    'model': 'gpt-4o-mini'},
    'gemini-flash': {'provider': 'google',    'model': 'gemini-1.5-flash'},
    'gemini-pro':   {'provider': 'google',    'model': 'gemini-1.5-pro'},
}

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

async def stream_chat(
    messages: list[dict],
    model_id: str,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    route = MODEL_MAP.get(model_id, MODEL_MAP['kroex-pro'])
    provider = route['provider']
    provider_model = route['model']

    if provider == 'anthropic':
        async for chunk in _stream_anthropic(messages, provider_model, system_prompt, temperature, max_tokens):
            yield chunk
    elif provider == 'openai':
        async for chunk in _stream_openai(messages, provider_model, system_prompt, temperature, max_tokens):
            yield chunk
    elif provider == 'google':
        async for chunk in _stream_google(messages, provider_model, system_prompt, temperature, max_tokens):
            yield chunk
    else:
        yield _sse({'type': 'error', 'message': f'Unknown provider: {provider}'})

async def _stream_anthropic(
    messages: list[dict],
    model: str,
    system_prompt: str | None,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    kwargs: dict = {
        'model': model,
        'max_tokens': max_tokens,
        'temperature': temperature,
        'messages': messages,
    }
    if system_prompt:
        kwargs['system'] = system_prompt

    input_tokens = 0
    output_tokens = 0

    async with client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            yield _sse({'type': 'delta', 'text': text})
        message = await stream.get_final_message()
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens

    yield _sse({
        'type': 'done',
        'model': model,
        'usage': {'input': input_tokens, 'output': output_tokens},
    })

async def _stream_openai(
    messages: list[dict],
    model: str,
    system_prompt: str | None,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    all_messages = []
    if system_prompt:
        all_messages.append({'role': 'system', 'content': system_prompt})
    all_messages.extend(messages)

    stream = await client.chat.completions.create(
        model=model,
        messages=all_messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
        stream_options={'include_usage': True},
    )
    input_tokens = output_tokens = 0
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield _sse({'type': 'delta', 'text': chunk.choices[0].delta.content})
        if chunk.usage:
            input_tokens = chunk.usage.prompt_tokens
            output_tokens = chunk.usage.completion_tokens

    yield _sse({
        'type': 'done',
        'model': model,
        'usage': {'input': input_tokens, 'output': output_tokens},
    })

async def _stream_google(
    messages: list[dict],
    model: str,
    system_prompt: str | None,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    import google.generativeai as genai
    genai.configure(api_key=settings.google_api_key)
    gmodel = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        ),
    )
    history = []
    for m in messages[:-1]:
        history.append({'role': 'user' if m['role'] == 'user' else 'model', 'parts': [m['content']]})

    last_msg = messages[-1]['content'] if messages else ''
    chat = gmodel.start_chat(history=history)
    response = await chat.send_message_async(last_msg, stream=True)
    async for chunk in response:
        if chunk.text:
            yield _sse({'type': 'delta', 'text': chunk.text})

    yield _sse({'type': 'done', 'model': model, 'usage': {'input': 0, 'output': 0}})
