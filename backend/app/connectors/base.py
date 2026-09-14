from abc import ABC, abstractmethod
from typing import Dict, Any, List
from app.schemas.connection import ConnectorInfo
from app.schemas.metadata import (
    IngestedDatabase,
    IngestedSchema,
    IngestedTable,
    IngestedColumn,
)


class BaseConnector(ABC):
    """
    Abstract Base Connector defining the standard interface for all MetaConnect data sources.
    Every new connector (MongoDB, PostgreSQL, Snowflake, MySQL, CockroachDB, etc.)
    inherits from this class.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize connector with configuration parameters.
        Parameters usually include: host, port, database_name, username, password, extra_params.
        """
        self.config = config
        self.host = config.get("host")
        self.port = config.get("port")
        self.database_name = config.get("database_name")
        self.username = config.get("username")
        self.password = config.get("password")
        self.extra_params = config.get("extra_params") or {}

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test live connectivity to the data source.
        Returns:
            {
                "success": bool,
                "message": str,
                "latency_ms": float,
                "details": dict
            }
        """
        pass

    @abstractmethod
    def get_databases(self) -> List[str]:
        """Fetch list of accessible databases / catalogs."""
        pass

    @abstractmethod
    def get_schemas(self, database: str) -> List[str]:
        """Fetch schemas for a given database."""
        pass

    @abstractmethod
    def get_tables(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """
        Fetch tables or collections for a given database and schema.
        Returns list of dicts with: name, table_type, row_count, size_bytes.
        """
        pass

    @abstractmethod
    def get_columns(
        self, database: str, schema: str, table: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch columns / fields for a specific table or collection.
        Returns list of dicts with: name, data_type, is_primary_key, is_nullable, description.
        """
        pass

    def extract_all(self) -> List[IngestedDatabase]:
        """
        Extract entire metadata hierarchy (Database -> Schema -> Table -> Column).
        Default implementation traverses the standard methods. Connectors can override for optimizations.
        """
        ingested_dbs: List[IngestedDatabase] = []
        databases = self.get_databases()

        for db_name in databases:
            schemas = self.get_schemas(db_name)
            ingested_schemas: List[IngestedSchema] = []

            for schema_name in schemas:
                tables = self.get_tables(db_name, schema_name)
                ingested_tables: List[IngestedTable] = []

                for tbl in tables:
                    columns_data = self.get_columns(db_name, schema_name, tbl["name"])
                    ingested_cols = [
                        IngestedColumn(
                            name=c["name"],
                            data_type=c["data_type"],
                            is_primary_key=c.get("is_primary_key", False),
                            is_nullable=c.get("is_nullable", True),
                            ordinal_position=c.get("ordinal_position", idx + 1),
                            description=c.get("description"),
                            properties=c.get("properties", {}),
                        )
                        for idx, c in enumerate(columns_data)
                    ]

                    ingested_tables.append(
                        IngestedTable(
                            name=tbl["name"],
                            table_type=tbl.get("table_type", "table"),
                            row_count=tbl.get("row_count", 0),
                            size_bytes=tbl.get("size_bytes", 0),
                            description=tbl.get("description"),
                            properties=tbl.get("properties", {}),
                            columns=ingested_cols,
                        )
                    )

                ingested_schemas.append(
                    IngestedSchema(name=schema_name, tables=ingested_tables)
                )

            ingested_dbs.append(
                IngestedDatabase(name=db_name, schemas=ingested_schemas)
            )

        return ingested_dbs

    @classmethod
    @abstractmethod
    def get_connector_info(cls) -> ConnectorInfo:
        """Returns connector metadata, display fields, and configuration schema."""
        pass
