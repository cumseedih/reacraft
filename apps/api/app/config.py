from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    # App
    app_name: str = 'KROEX API'
    debug: bool = False
    version: str = '0.1.0'
    environment: str = 'development'

    # Database
    database_url: str = 'postgresql+asyncpg://kroex:kroex@localhost:5432/kroex'
    database_pool_size: int = 10

    # Redis
    redis_url: str = 'redis://localhost:6379/0'

    # JWT
    jwt_secret: str = 'change-me-in-production'
    jwt_algorithm: str = 'HS256'
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # AI Provider keys (server-side only — never exposed to frontend)
    anthropic_api_key: str = ''
    openai_api_key: str = ''
    google_api_key: str = ''

    # S3 / object storage
    s3_bucket: str = 'kroex-uploads'
    s3_region: str = 'us-east-1'
    aws_access_key_id: str = ''
    aws_secret_access_key: str = ''

    # CORS
    allowed_origins: list[str] = ['http://localhost:3000']

    # Rate limiting
    rate_limit_per_minute: int = 60

@lru_cache
def get_settings() -> Settings:
    return Settings()
