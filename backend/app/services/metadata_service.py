import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.connection import Connection
from app.models.metadata import (
    MetadataDatabase,
    MetadataSchema,
    MetadataTable,
    MetadataColumn,
)
from app.models.ingestion import IngestionRun
from app.schemas.metadata import (
    DatabaseResponse,
    SchemaResponse,
    TableResponse,
    ColumnResponse,
    MetadataTreeNode,
    MetadataSyncPayload,
)

logger = logging.getLogger(__name__)


class MetadataService:

    @classmethod
    def get_tree(cls, db: Session, connection_id: uuid.UUID) -> MetadataTreeNode:
        """
        Builds a full hierarchical tree for visual explorer navigation:
        Connection -> Database -> Schema -> Table/Collection -> Column/Field
        """
        conn = db.query(Connection).filter(Connection.id == connection_id).first()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )

        root = MetadataTreeNode(
            id=str(conn.id),
            name=conn.name,
            type="connection",
            metadata={
                "connector_type": conn.connector_type,
                "status": conn.status,
                "host": conn.host,
                "port": conn.port,
                "database_name": conn.database_name,
                "last_ingested_at": (
                    conn.last_ingested_at.isoformat() if conn.last_ingested_at else None
                ),
            },
            children=[],
        )

        databases = (
            db.query(MetadataDatabase)
            .filter(MetadataDatabase.connection_id == conn.id)
            .all()
        )
        for database in databases:
            db_node = MetadataTreeNode(
                id=str(database.id),
                name=database.name,
                type="database",
                metadata={
                    "description": database.description,
                    "properties": database.properties,
                },
                children=[],
            )

            for sch in database.schemas:
                schema_node = MetadataTreeNode(
                    id=str(sch.id),
                    name=sch.name,
                    type="schema",
                    metadata={
                        "description": sch.description,
                        "properties": sch.properties,
                    },
                    children=[],
                )

                for tbl in sch.tables:
                    table_node = MetadataTreeNode(
                        id=str(tbl.id),
                        name=tbl.name,
                        type="table",
                        metadata={
                            "table_type": tbl.table_type,
                            "row_count": tbl.row_count,
                            "size_bytes": tbl.size_bytes,
                            "description": tbl.description,
                            "properties": tbl.properties,
                        },
                        children=[],
                    )

                    for col in tbl.columns:
                        col_node = MetadataTreeNode(
                            id=str(col.id),
                            name=col.name,
                            type="column",
                            metadata={
                                "data_type": col.data_type,
                                "is_primary_key": col.is_primary_key,
                                "is_nullable": col.is_nullable,
                                "ordinal_position": col.ordinal_position,
                                "description": col.description,
                                "properties": col.properties,
                            },
                            children=[],
                        )
                        table_node.children.append(col_node)

                    schema_node.children.append(table_node)

                db_node.children.append(schema_node)

            root.children.append(db_node)

        return root

    @classmethod
    def sync_metadata(cls, db: Session, payload: MetadataSyncPayload) -> Dict[str, Any]:
        """
        Takes raw metadata extracted by Airflow or the internal ingestion worker,
        and automatically upserts the hierarchy in PostgreSQL.
        """
        conn = (
            db.query(Connection).filter(Connection.id == payload.connection_id).first()
        )
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{payload.connection_id}' not found.",
            )

        now = datetime.now(timezone.utc)
        stats = {"databases": 0, "schemas": 0, "tables": 0, "columns": 0}

        try:
            for db_data in payload.databases:
                # Upsert database
                db_record = (
                    db.query(MetadataDatabase)
                    .filter(
                        MetadataDatabase.connection_id == conn.id,
                        MetadataDatabase.name == db_data.name,
                    )
                    .first()
                )

                if not db_record:
                    db_record = MetadataDatabase(
                        connection_id=conn.id,
                        name=db_data.name,
                        description=db_data.description,
                        properties=db_data.properties,
                    )
                    db.add(db_record)
                    db.flush()
                else:
                    db_record.description = db_data.description or db_record.description
                    db_record.properties = db_data.properties or db_record.properties
                    db_record.updated_at = now
                stats["databases"] += 1

                for sch_data in db_data.schemas:
                    sch_record = (
                        db.query(MetadataSchema)
                        .filter(
                            MetadataSchema.database_id == db_record.id,
                            MetadataSchema.name == sch_data.name,
                        )
                        .first()
                    )

                    if not sch_record:
                        sch_record = MetadataSchema(
                            database_id=db_record.id,
                            name=sch_data.name,
                            description=sch_data.description,
                            properties=sch_data.properties,
                        )
                        db.add(sch_record)
                        db.flush()
                    else:
                        sch_record.description = (
                            sch_data.description or sch_record.description
                        )
                        sch_record.properties = (
                            sch_data.properties or sch_record.properties
                        )
                        sch_record.updated_at = now
                    stats["schemas"] += 1

                    for tbl_data in sch_data.tables:
                        tbl_record = (
                            db.query(MetadataTable)
                            .filter(
                                MetadataTable.schema_id == sch_record.id,
                                MetadataTable.name == tbl_data.name,
                            )
                            .first()
                        )

                        if not tbl_record:
                            tbl_record = MetadataTable(
                                schema_id=sch_record.id,
                                name=tbl_data.name,
                                table_type=tbl_data.table_type,
                                row_count=tbl_data.row_count,
                                size_bytes=tbl_data.size_bytes,
                                description=tbl_data.description,
                                properties=tbl_data.properties,
                            )
                            db.add(tbl_record)
                            db.flush()
                        else:
                            tbl_record.row_count = tbl_data.row_count
                            tbl_record.size_bytes = tbl_data.size_bytes
                            tbl_record.description = (
                                tbl_data.description or tbl_record.description
                            )
                            tbl_record.properties = (
                                tbl_data.properties or tbl_record.properties
                            )
                            tbl_record.updated_at = now
                        stats["tables"] += 1

                        for col_data in tbl_data.columns:
                            col_record = (
                                db.query(MetadataColumn)
                                .filter(
                                    MetadataColumn.table_id == tbl_record.id,
                                    MetadataColumn.name == col_data.name,
                                )
                                .first()
                            )

                            if not col_record:
                                col_record = MetadataColumn(
                                    table_id=tbl_record.id,
                                    name=col_data.name,
                                    data_type=col_data.data_type,
                                    is_primary_key=col_data.is_primary_key,
                                    is_nullable=col_data.is_nullable,
                                    ordinal_position=col_data.ordinal_position,
                                    description=col_data.description,
                                    properties=col_data.properties,
                                )
                                db.add(col_record)
                            else:
                                col_record.data_type = col_data.data_type
                                col_record.is_primary_key = col_data.is_primary_key
                                col_record.is_nullable = col_data.is_nullable
                                col_record.ordinal_position = col_data.ordinal_position
                                col_record.description = (
                                    col_data.description or col_record.description
                                )
                                col_record.properties = (
                                    col_data.properties or col_record.properties
                                )
                                col_record.updated_at = now
                            stats["columns"] += 1

            # Update connection metadata
            conn.last_ingested_at = now
            conn.status = "CONNECTED"

            # Update ingestion run if run_id provided
            if payload.run_id:
                run = (
                    db.query(IngestionRun)
                    .filter(IngestionRun.id == payload.run_id)
                    .first()
                )
                if run:
                    run.status = payload.status
                    run.completed_at = now
                    run.stats = stats
                    run.error_message = payload.error_message

            db.commit()
            return {"success": True, "stats": stats}

        except Exception as e:
            db.rollback()
            logger.error(f"Metadata sync failed: {e}", exc_info=True)
            if payload.run_id:
                run = (
                    db.query(IngestionRun)
                    .filter(IngestionRun.id == payload.run_id)
                    .first()
                )
                if run:
                    run.status = "FAILED"
                    run.completed_at = now
                    run.error_message = str(e)
                    db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save metadata hierarchy: {str(e)}",
            )

    @classmethod
    def get_databases(
        cls, db: Session, connection_id: Optional[uuid.UUID] = None
    ) -> List[DatabaseResponse]:
        query = db.query(MetadataDatabase)
        if connection_id:
            query = query.filter(MetadataDatabase.connection_id == connection_id)
        return query.all()

    @classmethod
    def get_schemas(
        cls, db: Session, database_id: Optional[uuid.UUID] = None
    ) -> List[SchemaResponse]:
        query = db.query(MetadataSchema)
        if database_id:
            query = query.filter(MetadataSchema.database_id == database_id)
        return query.all()

    @classmethod
    def get_tables(
        cls, db: Session, schema_id: Optional[uuid.UUID] = None
    ) -> List[TableResponse]:
        query = db.query(MetadataTable)
        if schema_id:
            query = query.filter(MetadataTable.schema_id == schema_id)
        return query.all()

    @classmethod
    def get_columns(
        cls, db: Session, table_id: Optional[uuid.UUID] = None
    ) -> List[ColumnResponse]:
        query = db.query(MetadataColumn)
        if table_id:
            query = query.filter(MetadataColumn.table_id == table_id)
        return query.order_by(MetadataColumn.ordinal_position.asc()).all()
