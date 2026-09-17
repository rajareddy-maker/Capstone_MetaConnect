import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.connection import Connection
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionUpdate,
    ConnectionResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
)
from app.core.security import encrypt_secret, decrypt_secret
from app.connectors.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


class ConnectionService:

    @staticmethod
    def _to_response(conn: Connection) -> ConnectionResponse:
        return ConnectionResponse(
            id=conn.id,
            name=conn.name,
            description=conn.description,
            connector_type=conn.connector_type,
            host=conn.host,
            port=conn.port,
            database_name=conn.database_name,
            username=conn.username,
            extra_params=conn.extra_params or {},
            status=conn.status,
            has_password=bool(conn.password_encrypted),
            last_tested_at=conn.last_tested_at,
            last_ingested_at=conn.last_ingested_at,
            created_by=conn.created_by,
            created_at=conn.created_at,
            updated_at=conn.updated_at,
        )

    @classmethod
    def get_connections(
        cls,
        db: Session,
        name: Optional[str] = None,
        connector_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[ConnectionResponse]:
        query = db.query(Connection)
        if name:
            query = query.filter(Connection.name.ilike(f"%{name}%"))
        if connector_type:
            query = query.filter(Connection.connector_type == connector_type.lower())
        if status:
            query = query.filter(Connection.status == status.upper())

        connections = query.order_by(Connection.created_at.desc()).all()
        return [cls._to_response(c) for c in connections]

    @classmethod
    def get_connection_by_id(cls, db: Session, connection_id: uuid.UUID) -> Connection:
        conn = db.query(Connection).filter(Connection.id == connection_id).first()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection with ID '{connection_id}' not found.",
            )
        return conn

    @classmethod
    def create_connection(
        cls, db: Session, payload: ConnectionCreate, username: str = "admin"
    ) -> ConnectionResponse:
        # Check uniqueness of name
        existing = db.query(Connection).filter(Connection.name == payload.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Connection with name '{payload.name}' already exists.",
            )

        # Verify connector support
        if not ConnectorRegistry.is_supported(payload.connector_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Connector type '{payload.connector_type}' is not currently active or supported.",
            )

        encrypted_pwd = encrypt_secret(payload.password) if payload.password else None

        conn = Connection(
            name=payload.name,
            description=payload.description,
            connector_type=payload.connector_type.lower(),
            host=payload.host,
            port=payload.port,
            database_name=payload.database_name,
            username=payload.username,
            password_encrypted=encrypted_pwd,
            extra_params=payload.extra_params,
            status="CONNECTED",
            created_by=username,
        )

        db.add(conn)
        db.commit()
        db.refresh(conn)
        return cls._to_response(conn)

    @classmethod
    def update_connection(
        cls, db: Session, connection_id: uuid.UUID, payload: ConnectionUpdate
    ) -> ConnectionResponse:
        conn = cls.get_connection_by_id(db, connection_id)

        if payload.name and payload.name != conn.name:
            existing = (
                db.query(Connection).filter(Connection.name == payload.name).first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Connection name '{payload.name}' is already in use.",
                )
            conn.name = payload.name

        if payload.description is not None:
            conn.description = payload.description
        if payload.host is not None:
            conn.host = payload.host
        if payload.port is not None:
            conn.port = payload.port
        if payload.database_name is not None:
            conn.database_name = payload.database_name
        if payload.username is not None:
            conn.username = payload.username
        if payload.password:
            conn.password_encrypted = encrypt_secret(payload.password)
        if payload.extra_params is not None:
            conn.extra_params = payload.extra_params

        conn.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(conn)
        return cls._to_response(conn)

    @classmethod
    def delete_connection(cls, db: Session, connection_id: uuid.UUID):
        conn = cls.get_connection_by_id(db, connection_id)
        db.delete(conn)
        db.commit()

    @classmethod
    def test_connection_params(
        cls, payload: ConnectionTestRequest
    ) -> ConnectionTestResponse:
        """Test connectivity given raw parameters without saving."""
        if not ConnectorRegistry.is_supported(payload.connector_type):
            return ConnectionTestResponse(
                success=False,
                message=f"Connector '{payload.connector_type}' is not yet supported for live testing.",
                details={"supported": False},
            )

        config = {
            "host": payload.host,
            "port": payload.port,
            "database_name": payload.database_name,
            "username": payload.username,
            "password": payload.password,
            "extra_params": payload.extra_params,
        }

        try:
            connector = ConnectorRegistry.instantiate(payload.connector_type, config)
            result = connector.test_connection()
            return ConnectionTestResponse(
                success=result.get("success", False),
                message=result.get("message", "Test completed"),
                latency_ms=result.get("latency_ms"),
                details=result.get("details", {}),
            )
        except Exception as e:
            return ConnectionTestResponse(
                success=False,
                message=f"Connection test error: {str(e)}",
                details={"error": str(e)},
            )

    @classmethod
    def test_saved_connection(
        cls, db: Session, connection_id: uuid.UUID
    ) -> ConnectionTestResponse:
        """Test an existing saved connection and update its status in the database."""
        conn = cls.get_connection_by_id(db, connection_id)
        raw_pwd = decrypt_secret(conn.password_encrypted)

        config = {
            "host": conn.host,
            "port": conn.port,
            "database_name": conn.database_name,
            "username": conn.username,
            "password": raw_pwd,
            "extra_params": conn.extra_params or {},
        }

        try:
            connector = ConnectorRegistry.instantiate(conn.connector_type, config)
            result = connector.test_connection()
            is_success = result.get("success", False)

            conn.status = "CONNECTED" if is_success else "FAILED"
            conn.last_tested_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(conn)

            return ConnectionTestResponse(
                success=is_success,
                message=result.get("message", "Test completed"),
                latency_ms=result.get("latency_ms"),
                details=result.get("details", {}),
            )
        except Exception as e:
            conn.status = "FAILED"
            conn.last_tested_at = datetime.now(timezone.utc)
            db.commit()
            return ConnectionTestResponse(
                success=False,
                message=f"Connection test failed: {str(e)}",
                details={"error": str(e)},
            )
