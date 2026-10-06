from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aceno:aceno@localhost:5432/aceno"

    class Config:
        env_file = ".env"


settings = Settings()
