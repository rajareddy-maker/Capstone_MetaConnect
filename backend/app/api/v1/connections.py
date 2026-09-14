import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionUpdate,
    ConnectionResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ConnectorInfo,
)
from app.schemas.ingestion import IngestionTriggerResponse
from app.services.connection_service import ConnectionService
from app.services.airflow_service import AirflowService
from app.connectors.registry import ConnectorRegistry

router = APIRouter(prefix="/connections", tags=["Connections"])


@router.get("/templates/connectors", response_model=List[ConnectorInfo])
def get_connector_templates():
    """Retrieve metadata and form specifications for supported connectors."""
    return ConnectorRegistry.list_connectors()


@router.get("", response_model=List[ConnectionResponse])
def list_connections(
    name: Optional[str] = Query(None, description="Filter by name"),
    type: Optional[str] = Query(None, description="Filter by connector type"),
    status: Optional[str] = Query(
        None, description="Filter by status (CONNECTED, FAILED, UNTESTED)"
    ),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all configured data connections with filtering options."""
    return ConnectionService.get_connections(
        db, name=name, connector_type=type, status=status
    )


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    payload: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create and register a new data source connection."""
    username = current_user.get("username", "admin")
    return ConnectionService.create_connection(db, payload, username=username)


@router.get("/{connection_id}", response_model=ConnectionResponse)
def get_connection(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve details of a single connection."""
    conn = ConnectionService.get_connection_by_id(db, connection_id)
    return ConnectionService._to_response(conn)


@router.put("/{connection_id}", response_model=ConnectionResponse)
def update_connection(
    connection_id: uuid.UUID,
    payload: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update an existing data connection."""
    return ConnectionService.update_connection(db, connection_id, payload)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a data connection and its ingested metadata."""
    ConnectionService.delete_connection(db, connection_id)
    return None


@router.post("/test", response_model=ConnectionTestResponse)
def test_connection_params(
    payload: ConnectionTestRequest, current_user: dict = Depends(get_current_user)
):
    """Test connection parameters live before saving."""
    return ConnectionService.test_connection_params(payload)


@router.post("/{connection_id}/test", response_model=ConnectionTestResponse)
def test_saved_connection(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Test an existing saved connection and update its health status."""
    return ConnectionService.test_saved_connection(db, connection_id)


@router.post("/{connection_id}/ingest", response_model=IngestionTriggerResponse)
def trigger_metadata_ingestion(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Trigger Airflow metadata ingestion pipeline for the specified connection."""
    return AirflowService.trigger_ingestion(db, connection_id)
