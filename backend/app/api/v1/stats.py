from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.connection import Connection
from app.models.metadata import (
    MetadataDatabase,
    MetadataSchema,
    MetadataTable,
    MetadataColumn,
)
from app.models.ingestion import IngestionRun

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/dashboard")
def get_dashboard_metrics(
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Provides high-level aggregation statistics for the dashboard overview."""
    total_connections = db.query(func.count(Connection.id)).scalar() or 0
    total_databases = db.query(func.count(MetadataDatabase.id)).scalar() or 0
    total_schemas = db.query(func.count(MetadataSchema.id)).scalar() or 0
    total_tables = db.query(func.count(MetadataTable.id)).scalar() or 0
    total_columns = db.query(func.count(MetadataColumn.id)).scalar() or 0

    # Connector type breakdown
    conn_types_raw = (
        db.query(Connection.connector_type, func.count(Connection.id))
        .group_by(Connection.connector_type)
        .all()
    )
    connectors_breakdown = {t: count for t, count in conn_types_raw}

    # Connection status breakdown
    conn_statuses_raw = (
        db.query(Connection.status, func.count(Connection.id))
        .group_by(Connection.status)
        .all()
    )
    status_breakdown = {s: count for s, count in conn_statuses_raw}

    # Ingestion runs stats
    total_runs = db.query(func.count(IngestionRun.id)).scalar() or 0
    successful_runs = (
        db.query(func.count(IngestionRun.id))
        .filter(IngestionRun.status == "SUCCESS")
        .scalar()
        or 0
    )

    return {
        "overview": {
            "total_connections": total_connections,
            "total_databases": total_databases,
            "total_schemas": total_schemas,
            "total_tables": total_tables,
            "total_columns": total_columns,
            "total_ingestion_runs": total_runs,
            "successful_ingestion_runs": successful_runs,
        },
        "connectors_breakdown": connectors_breakdown,
        "status_breakdown": status_breakdown,
        "current_user": current_user,
    }
