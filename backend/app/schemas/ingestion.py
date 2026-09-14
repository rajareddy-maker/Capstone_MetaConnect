import uuid
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class IngestionRunResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    connection_name: Optional[str] = None
    connector_type: Optional[str] = None
    dag_run_id: Optional[str] = None
    status: str
    airflow_state: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    stats: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IngestionTriggerResponse(BaseModel):
    success: bool
    message: str
    run_id: uuid.UUID
    dag_run_id: Optional[str] = None
    status: str = "PENDING"


class IngestionExecuteRequest(BaseModel):
    connection_id: uuid.UUID
    run_id: uuid.UUID
