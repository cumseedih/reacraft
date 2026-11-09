from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    # App
    app_name: str = 'KROEX API'
    debug: bool = False
    version: str = '0.1.0'
    environment: str = 'development'

    # Database
    database_url: str = 'postgresql+asyncpg://kroex:kroex_dev_only@localhost:5432/kroex'
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

    # File uploads
    upload_dir: str = '/app/uploads'
    max_upload_size_mb: int = 50

    # S3 / object storage (optional — leave blank to use local disk)
    s3_bucket: str = ''
    s3_region: str = 'us-east-1'
    aws_access_key_id: str = ''
    aws_secret_access_key: str = ''

    # CORS
    allowed_origins: list[str] = ['http://localhost:3000']

    # Rate limiting
    rate_limit_per_minute: int = 60

    @model_validator(mode='after')
    def check_production_secrets(self) -> 'Settings':
        if self.environment == 'production':
            if self.jwt_secret == 'change-me-in-production':
                raise ValueError(
                    'JWT_SECRET must be changed from the default value before running in '
                    'production. Generate one with: '
                    'python3 -c "import secrets; print(secrets.token_hex(64))"'
                )
            if 'kroex_dev_only' in self.database_url:
                raise ValueError(
                    'DATABASE_URL contains the default development password. '
                    'Set a strong unique database password before running in production.'
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
