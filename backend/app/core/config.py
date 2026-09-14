from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "MetaConnect API"
    API_V1_STR: str = "/api/v1"

    # Database Settings
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/metaconnect",
        validation_alias="DATABASE_URL",
    )

    # Credential Encryption Key (Fernet 32 url-safe base64-encoded bytes)
    # Default fallback key provided for local development
    ENCRYPTION_KEY: str = Field(
        default="g2_vX23hH63t5kYmQvP_xR-f3b1j6L0Yn4pT7sK9vZg=",
        validation_alias="ENCRYPTION_KEY",
    )

    # Keycloak OIDC Settings
    KEYCLOAK_URL: str = Field(
        default="http://localhost:8080", validation_alias="KEYCLOAK_URL"
    )
    KEYCLOAK_REALM: str = Field(
        default="metaconnect", validation_alias="KEYCLOAK_REALM"
    )
    KEYCLOAK_CLIENT_ID: str = Field(
        default="metaconnect-backend", validation_alias="KEYCLOAK_CLIENT_ID"
    )
    # Airflow Integration Settings
    AIRFLOW_BASE_URL: str = Field(
        default="http://localhost:8085", validation_alias="AIRFLOW_BASE_URL"
    )
    AIRFLOW_USERNAME: str = Field(default="admin", validation_alias="AIRFLOW_USERNAME")
    AIRFLOW_PASSWORD: str = Field(default="admin", validation_alias="AIRFLOW_PASSWORD")
    AIRFLOW_DAG_ID: str = "metadata_ingestion_pipeline"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "*",
    ]

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


settings = Settings()
