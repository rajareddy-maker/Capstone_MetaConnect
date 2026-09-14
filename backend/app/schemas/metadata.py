import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ColumnResponse(BaseModel):
    id: uuid.UUID
    table_id: uuid.UUID
    name: str
    data_type: str
    is_primary_key: bool
    is_nullable: bool
    ordinal_position: int
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TableResponse(BaseModel):
    id: uuid.UUID
    schema_id: uuid.UUID
    name: str
    table_type: str
    row_count: int
    size_bytes: int
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    columns: Optional[List[ColumnResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SchemaResponse(BaseModel):
    id: uuid.UUID
    database_id: uuid.UUID
    name: str
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    tables: Optional[List[TableResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatabaseResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    name: str
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    schemas: Optional[List[SchemaResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Hierarchical Tree Response for Visual Navigation
class MetadataTreeNode(BaseModel):
    id: str
    name: str
    type: str  # 'connection', 'database', 'schema', 'table', 'column'
    metadata: Dict[str, Any] = Field(default_factory=dict)
    children: List["MetadataTreeNode"] = Field(default_factory=list)


# Internal Sync Schema for Airflow Pipeline or Ingestion Worker
class IngestedColumn(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool = False
    is_nullable: bool = True
    ordinal_position: int = 0
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)


class IngestedTable(BaseModel):
    name: str
    table_type: str = "table"
    row_count: int = 0
    size_bytes: int = 0
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    columns: List[IngestedColumn] = Field(default_factory=list)


class IngestedSchema(BaseModel):
    name: str
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    tables: List[IngestedTable] = Field(default_factory=list)


class IngestedDatabase(BaseModel):
    name: str
    description: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)
    schemas: List[IngestedSchema] = Field(default_factory=list)


class MetadataSyncPayload(BaseModel):
    connection_id: uuid.UUID
    run_id: Optional[uuid.UUID] = None
    databases: List[IngestedDatabase] = Field(default_factory=list)
    status: str = "SUCCESS"
    error_message: Optional[str] = None
