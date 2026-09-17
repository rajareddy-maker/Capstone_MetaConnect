import uuid
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.ingestion import IngestionRunResponse, IngestionExecuteRequest
from app.services.airflow_service import AirflowService

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


@router.post("/internal/execute")
def execute_ingestion(
    payload: IngestionExecuteRequest,
    db: Session = Depends(get_db),
):
    """Execute connector extraction and persist metadata for an Airflow run."""
    return AirflowService.execute_ingestion(db, payload.connection_id, payload.run_id)


@router.get("/runs", response_model=List[IngestionRunResponse])
def get_recent_runs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve recent metadata ingestion runs across all connections."""
    return AirflowService.get_all_runs(db, limit=limit)


@router.get("/{run_id}", response_model=IngestionRunResponse)
def get_run_status(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the status and statistics of a specific ingestion run."""
    return AirflowService.get_run_status(db, run_id)


@router.get(
    "/connection/{connection_id}/history", response_model=List[IngestionRunResponse]
)
def get_connection_history(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the pipeline execution history for a given connection."""
    return AirflowService.get_connection_history(db, connection_id)
