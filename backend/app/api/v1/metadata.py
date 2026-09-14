import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.metadata import (
    DatabaseResponse,
    SchemaResponse,
    TableResponse,
    ColumnResponse,
    MetadataTreeNode,
)
from app.services.metadata_service import MetadataService

router = APIRouter(prefix="/metadata", tags=["Metadata"])


@router.get("/tree/{connection_id}", response_model=MetadataTreeNode)
def get_metadata_tree(
    connection_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve full hierarchical tree for visual catalog explorer."""
    return MetadataService.get_tree(db, connection_id)


@router.get("/databases", response_model=List[DatabaseResponse])
def list_databases(
    connection_id: Optional[uuid.UUID] = Query(
        None, description="Filter by connection ID"
    ),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List databases with optional connection filter."""
    return MetadataService.get_databases(db, connection_id)


@router.get("/schemas", response_model=List[SchemaResponse])
def list_schemas(
    database_id: Optional[uuid.UUID] = Query(None, description="Filter by database ID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List schemas with optional database filter."""
    return MetadataService.get_schemas(db, database_id)


@router.get("/tables", response_model=List[TableResponse])
def list_tables(
    schema_id: Optional[uuid.UUID] = Query(None, description="Filter by schema ID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List tables or collections with optional schema filter."""
    return MetadataService.get_tables(db, schema_id)


@router.get("/columns", response_model=List[ColumnResponse])
def list_columns(
    table_id: Optional[uuid.UUID] = Query(None, description="Filter by table ID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List columns or attributes for a specific table."""
    return MetadataService.get_columns(db, table_id)


