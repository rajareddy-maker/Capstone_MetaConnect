import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ConnectionBase(BaseModel):
    name: str = Field(
        ..., min_length=2, max_length=255, description="Unique connection name"
    )
    description: Optional[str] = Field(None, max_length=1000)
    connector_type: str = Field(
        ..., description="Connector type (e.g. mongodb, postgresql)"
    )
    host: Optional[str] = Field(None, description="Host address or server hostname")
    port: Optional[int] = Field(
        None, description="Port number (e.g. 27017 for MongoDB)"
    )
    database_name: Optional[str] = Field(
        None, description="Default database/auth source name"
    )
    username: Optional[str] = Field(None, description="Authentication username")
    extra_params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional connector parameters (e.g. uri, ssl)",
    )

    @field_validator("connector_type")
    def validate_type(cls, v: str) -> str:
        v = v.lower().strip()
        allowed = ["mongodb"]
        if v not in allowed:
            raise ValueError(
                f"Unsupported connector type: {v}. Must be one of {allowed}"
            )
        return v


class ConnectionCreate(ConnectionBase):
    password: Optional[str] = Field(
        None, description="Plaintext password (will be encrypted on save)"
    )


class ConnectionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = Field(
        None, description="New plaintext password to update"
    )
    extra_params: Optional[Dict[str, Any]] = None


class ConnectionResponse(ConnectionBase):
    id: uuid.UUID
    status: str
    has_password: bool = False
    last_tested_at: Optional[datetime] = None
    last_ingested_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConnectionTestRequest(BaseModel):
    connector_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    extra_params: Dict[str, Any] = Field(default_factory=dict)


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[float] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class ConnectorField(BaseModel):
    name: str
    label: str
    type: str  # text, password, number, select, boolean
    required: bool = False
    default: Optional[Any] = None
    placeholder: Optional[str] = None
    description: Optional[str] = None


class ConnectorInfo(BaseModel):
    type: str
    display_name: str
    icon: str
    description: str
    is_active: bool = True
    default_port: int
    fields: List[ConnectorField]
