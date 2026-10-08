from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aceno:aceno@localhost:5432/aceno"
    jwt_secret: str = "dev-secret-troque-em-producao"
    jwt_expire_horas: int = 12

    class Config:
        env_file = ".env"


settings = Settings()
