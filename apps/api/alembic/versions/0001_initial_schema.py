"""initial schema

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-11-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # pgvector: use a PL/pgSQL DO block so failure doesn't abort the outer
    # transaction (exception is caught inside the anonymous block).
    conn.execute(sa.text("""
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
        EXCEPTION WHEN others THEN
            NULL;
        END $$
    """))

    # Detect whether pgvector is available after the attempt
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'"
    ))
    has_vector = result.scalar() == 1

    if has_vector:
        from pgvector.sqlalchemy import Vector
        embedding_type: sa.types.TypeEngine = Vector(1536)
    else:
        embedding_type = sa.Text()

    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('avatar', sa.String(512), nullable=True),
        sa.Column('plan', sa.String(10), nullable=False, server_default='free'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('system_prompt', sa.Text, nullable=True),
        sa.Column('color', sa.String(32), nullable=True),
        sa.Column('icon', sa.String(64), nullable=True),
        sa.Column('metadata', sa.JSON, nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_projects_user_id', 'projects', ['user_id'])

    op.create_table(
        'conversations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(512), nullable=False, server_default='New conversation'),
        sa.Column('model', sa.String(128), nullable=False, server_default='kroex-pro'),
        sa.Column('system_prompt', sa.Text, nullable=True),
        sa.Column('pinned', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('archived', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('metadata', sa.JSON, nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_conversations_user_id', 'conversations', ['user_id'])
    op.create_index('ix_conversations_project_id', 'conversations', ['project_id'])

    op.create_table(
        'messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'conversation_id',
            sa.String(36),
            sa.ForeignKey('conversations.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('content', sa.Text, nullable=False, server_default=''),
        sa.Column('model', sa.String(128), nullable=True),
        sa.Column('tokens_in', sa.Integer, nullable=True),
        sa.Column('tokens_out', sa.Integer, nullable=True),
        sa.Column('feedback', sa.String(16), nullable=True),
        sa.Column('metadata', sa.JSON, nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])

    op.create_table(
        'project_files',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'project_id',
            sa.String(36),
            sa.ForeignKey('projects.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('name', sa.String(512), nullable=False),
        sa.Column('content_type', sa.String(128), nullable=False),
        sa.Column('size', sa.Integer, nullable=False),
        sa.Column('storage_key', sa.String(512), nullable=False),
        sa.Column('extracted_text', sa.Text, nullable=True),
        sa.Column('chunk_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_project_files_project_id', 'project_files', ['project_id'])

    op.create_table(
        'document_chunks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'file_id',
            sa.String(36),
            sa.ForeignKey('project_files.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('chunk_index', sa.Integer, nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('embedding', embedding_type, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_document_chunks_file_id', 'document_chunks', ['file_id'])

    op.create_table(
        'memories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('source', sa.String(64), nullable=False, server_default='manual'),
        sa.Column('source_id', sa.String(36), nullable=True),
        sa.Column('embedding', embedding_type, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_memories_user_id', 'memories', ['user_id'])

    op.create_table(
        'artifacts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'conversation_id',
            sa.String(36),
            sa.ForeignKey('conversations.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(512), nullable=False, server_default='Untitled'),
        sa.Column('type', sa.String(64), nullable=False, server_default='code'),
        sa.Column('language', sa.String(64), nullable=True),
        sa.Column('content', sa.Text, nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_artifacts_conversation_id', 'artifacts', ['conversation_id'])
    op.create_index('ix_artifacts_user_id', 'artifacts', ['user_id'])


def downgrade() -> None:
    op.drop_table('artifacts')
    op.drop_table('memories')
    op.drop_table('document_chunks')
    op.drop_table('project_files')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('projects')
    op.drop_table('users')
    op.execute(sa.text('DROP EXTENSION IF EXISTS vector'))
