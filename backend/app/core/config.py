from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DB_URL: str
    
    JWT_SECRET: str
    REFRESH_TOKEN_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 8
    REFRESH_TOKEN_EXPIRY_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    
    LOG_LEVEL: str = "DEBUG"
    LOG_BACKUP_COUNT: int = 72

    # Pydantic v2 specific settings config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
