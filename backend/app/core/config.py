from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_DB:str 
    POSTGRES_USER: str 
    POSTGRES_PASSWORD: str 
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    SECRET_KEY: str 
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
