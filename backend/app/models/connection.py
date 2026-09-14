import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Connection(Base):
    __tablename__ = "connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    connector_type = Column(
        String(50), nullable=False, index=True
    )  

    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    password_encrypted = Column(Text, nullable=True)
    extra_params = Column(JSONB, default=dict)

    status = Column(
        String(50), default="UNTESTED", index=True
    )  # 'CONNECTED', 'FAILED', 'UNTESTED'
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_ingested_at = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(String(255), default="admin")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    databases = relationship(
        "MetadataDatabase", back_populates="connection", cascade="all, delete-orphan"
    )
    ingestion_runs = relationship(
        "IngestionRun", back_populates="connection", cascade="all, delete-orphan"
    )
