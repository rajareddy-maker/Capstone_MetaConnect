import logging
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from app.models.connection import Connection
from app.models.metadata import (
    MetadataDatabase,
    MetadataSchema,
    MetadataTable,
    MetadataColumn,
)
from app.schemas.search import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)


class SearchService:

    @classmethod
    def global_search(
        cls,
        db: Session,
        query_str: str,
        entity_filter: Optional[str] = None,
        limit: int = 50,
    ) -> SearchResponse:
        results: List[SearchResultItem] = []
        counts: Dict[str, int] = {
            "connection": 0,
            "database": 0,
            "schema": 0,
            "table": 0,
            "column": 0,
        }
        clean_q = f"%{query_str.strip()}%"

        # 1. Search Connections
        if not entity_filter or entity_filter.lower() == "connection":
            conns = (
                db.query(Connection)
                .filter(Connection.name.ilike(clean_q))
                .limit(limit)
                .all()
            )

            for c in conns:
                counts["connection"] += 1
                results.append(
                    SearchResultItem(
                        id=str(c.id),
                        entity_type="connection",
                        name=c.name,
                        breadcrumb=f"{c.name} ({c.connector_type})",
                        description=c.description,
                        connection_id=str(c.id),
                    )
                )

        # 2. Search Databases
        if not entity_filter or entity_filter.lower() == "database":
            dbs = (
                db.query(MetadataDatabase)
                .filter(MetadataDatabase.name.ilike(clean_q))
                .limit(limit)
                .all()
            )

            for d in dbs:
                counts["database"] += 1
                conn_name = d.connection.name if d.connection else "Unknown"
                results.append(
                    SearchResultItem(
                        id=str(d.id),
                        entity_type="database",
                        name=d.name,
                        breadcrumb=f"{conn_name} > {d.name}",
                        description=d.description,
                        connection_id=str(d.connection_id),
                        database_id=str(d.id),
                    )
                )

        # 3. Search Schemas
        if not entity_filter or entity_filter.lower() == "schema":
            schs = (
                db.query(MetadataSchema)
                .filter(MetadataSchema.name.ilike(clean_q))
                .limit(limit)
                .all()
            )

            for s in schs:
                counts["schema"] += 1
                db_name = s.database.name if s.database else "Unknown"
                conn_name = (
                    s.database.connection.name
                    if s.database and s.database.connection
                    else "Unknown"
                )
                results.append(
                    SearchResultItem(
                        id=str(s.id),
                        entity_type="schema",
                        name=s.name,
                        breadcrumb=f"{conn_name} > {db_name} > {s.name}",
                        description=s.description,
                        connection_id=(
                            str(s.database.connection_id) if s.database else None
                        ),
                        database_id=str(s.database_id),
                        schema_id=str(s.id),
                    )
                )

        # 4. Search Tables / Collections
        if not entity_filter or entity_filter.lower() == "table":
            tbls = (
                db.query(MetadataTable)
                .filter(MetadataTable.name.ilike(clean_q))
                .limit(limit)
                .all()
            )

            for t in tbls:
                counts["table"] += 1
                sch_name = t.schema.name if t.schema else "Unknown"
                db_name = (
                    t.schema.database.name
                    if t.schema and t.schema.database
                    else "Unknown"
                )
                conn_name = (
                    t.schema.database.connection.name
                    if t.schema and t.schema.database and t.schema.database.connection
                    else "Unknown"
                )
                conn_id = (
                    str(t.schema.database.connection_id)
                    if t.schema and t.schema.database
                    else None
                )

                results.append(
                    SearchResultItem(
                        id=str(t.id),
                        entity_type="table",
                        name=t.name,
                        breadcrumb=f"{conn_name} > {db_name} > {sch_name} > {t.name}",
                        description=t.description,
                        row_count=t.row_count,
                        connection_id=conn_id,
                        database_id=str(t.schema.database_id) if t.schema else None,
                        schema_id=str(t.schema_id),
                        table_id=str(t.id),
                    )
                )

        # 5. Search Columns / Attributes
        if not entity_filter or entity_filter.lower() == "column":
            cols = (
                db.query(MetadataColumn)
                .filter(MetadataColumn.name.ilike(clean_q))
                .limit(limit)
                .all()
            )

            for col in cols:
                counts["column"] += 1
                tbl = col.table
                sch = tbl.schema if tbl else None
                database = sch.database if sch else None
                conn = database.connection if database else None

                conn_name = conn.name if conn else "Unknown"
                db_name = database.name if database else "Unknown"
                tbl_name = tbl.name if tbl else "Unknown"

                results.append(
                    SearchResultItem(
                        id=str(col.id),
                        entity_type="column",
                        name=col.name,
                        breadcrumb=f"{conn_name} > {db_name} > {tbl_name} > {col.name}",
                        description=col.description,
                        data_type=col.data_type,
                        is_primary_key=col.is_primary_key,
                        connection_id=str(conn.id) if conn else None,
                        database_id=str(database.id) if database else None,
                        schema_id=str(sch.id) if sch else None,
                        table_id=str(tbl.id) if tbl else None,
                    )
                )

        # Cap results
        capped_results = results[:limit]

        return SearchResponse(
            query=query_str,
            total_matches=len(results),
            results=capped_results,
            grouped_counts=counts,
        )
