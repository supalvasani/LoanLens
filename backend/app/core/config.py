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

    # ── LLM (chatbot) ─────────────────────────────────────────────────────────
    # Base URL of any OpenAI-compatible endpoint.
    # Local Ollama:  http://localhost:11434/v1
    # OpenAI:        https://api.openai.com/v1
    # Leave blank to get a clear 503 (misconfiguration error), or set
    # LLM_MOCK=true to return a deterministic stub (CI / tests).
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""           # Optional; omit for local Ollama
    LLM_MODEL: str = "llama3.1"     # Must support tool/function calling
    LLM_TIMEOUT_SECONDS: int = 60
    LLM_MOCK: bool = False          # Set true in CI / unit tests

    # Pydantic v2 specific settings config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
