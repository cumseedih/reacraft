"""
Document text extraction.
Supports: .txt, .md, .pdf (pypdf), .docx (python-docx)
"""
import aiofiles

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100

SUPPORTED_EXTENSIONS = {'.txt', '.md', '.pdf', '.docx'}
EXTENSION_TO_CONTENT_TYPE = {
    '.txt':  'text/plain',
    '.md':   'text/markdown',
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}


async def extract_text(file_path: str, content_type: str) -> str:
    """Return plain text from a file; empty string on failure."""
    ct = content_type.split(';')[0].strip().lower()

    if ct in ('text/plain', 'text/markdown', 'text/x-markdown'):
        try:
            async with aiofiles.open(file_path, 'r', errors='replace') as f:
                return await f.read()
        except Exception:
            return ''

    if ct == 'application/pdf':
        return await _run_sync(_extract_pdf_sync, file_path)

    if ct == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await _run_sync(_extract_docx_sync, file_path)

    return ''


async def _run_sync(fn, *args):
    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fn, *args)


def _extract_pdf_sync(file_path: str) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return '\n'.join(pages)
    except Exception:
        return ''


def _extract_docx_sync(file_path: str) -> str:
    try:
        from docx import Document
        doc = Document(file_path)
        return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception:
        return ''


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks, breaking on word boundaries."""
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            last_space = text.rfind(' ', start, end)
            if last_space > start:
                end = last_space
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap if end - overlap > start else end
    return chunks
