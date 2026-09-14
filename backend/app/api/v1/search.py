from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.search import SearchResponse
from app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
def search_catalog(
    q: str = Query(..., min_length=1, description="Search query string"),
    type: Optional[str] = Query(
        None,
        description="Optional entity filter: connection, database, schema, table, column",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Global search across connections, databases, schemas, tables/collections, and columns."""
    return SearchService.global_search(db, query_str=q, entity_filter=type, limit=limit)
