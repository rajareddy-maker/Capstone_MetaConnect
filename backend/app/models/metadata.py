import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class MetadataDatabase(Base):
    __tablename__ = "metadata_databases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    properties = Column(JSONB, default=dict)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("connection_id", "name", name="uq_connection_database_name"),
    )

    connection = relationship("Connection", back_populates="databases")
    schemas = relationship(
        "MetadataSchema", back_populates="database", cascade="all, delete-orphan"
    )


class MetadataSchema(Base):
    __tablename__ = "metadata_schemas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    database_id = Column(
        UUID(as_uuid=True),
        ForeignKey("metadata_databases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)  # e.g. 'public' or 'default'
    description = Column(Text, nullable=True)
    properties = Column(JSONB, default=dict)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("database_id", "name", name="uq_database_schema_name"),
    )

    database = relationship("MetadataDatabase", back_populates="schemas")
    tables = relationship(
        "MetadataTable", back_populates="schema", cascade="all, delete-orphan"
    )


class MetadataTable(Base):
    __tablename__ = "metadata_tables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schema_id = Column(
        UUID(as_uuid=True),
        ForeignKey("metadata_schemas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(
        String(255), nullable=False, index=True
    )  # collection name or table name
    table_type = Column(String(50), default="table")  # 'table', 'collection', 'view'
    row_count = Column(BigInteger, default=0)
    size_bytes = Column(BigInteger, default=0)
    description = Column(Text, nullable=True)
    properties = Column(JSONB, default=dict)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("schema_id", "name", name="uq_schema_table_name"),
    )

    schema = relationship("MetadataSchema", back_populates="tables")
    columns = relationship(
        "MetadataColumn", back_populates="table", cascade="all, delete-orphan"
    )


class MetadataColumn(Base):
    __tablename__ = "metadata_columns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_id = Column(
        UUID(as_uuid=True),
        ForeignKey("metadata_tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    data_type = Column(String(100), nullable=False)
    is_primary_key = Column(Boolean, default=False)
    is_nullable = Column(Boolean, default=True)
    ordinal_position = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    properties = Column(JSONB, default=dict)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("table_id", "name", name="uq_table_column_name"),
    )

    table = relationship("MetadataTable", back_populates="columns")
