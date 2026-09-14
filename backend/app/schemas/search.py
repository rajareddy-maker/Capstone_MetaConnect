from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    id: str
    entity_type: str  # 'connection', 'database', 'schema', 'table', 'column'
    name: str
    breadcrumb: str
    description: Optional[str] = None
    data_type: Optional[str] = None
    is_primary_key: Optional[bool] = None
    row_count: Optional[int] = None
    connection_id: Optional[str] = None
    database_id: Optional[str] = None
    schema_id: Optional[str] = None
    table_id: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    total_matches: int
    results: List[SearchResultItem]
    grouped_counts: Dict[str, int] = Field(default_factory=dict)
