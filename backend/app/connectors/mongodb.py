import time
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Set
from bson import ObjectId
from pymongo import MongoClient
from app.connectors.base import BaseConnector
from app.schemas.connection import ConnectorInfo, ConnectorField


class MongoDBConnector(BaseConnector):
    """
    MongoDB Connector implementation for MetaConnect.
    Connects to standalone instances, replica sets, or MongoDB Atlas clusters.
    Extracts databases, collections, and infers document schemas.
    """

    def _get_connection_uri(self) -> str:
        # Check if custom URI is provided in extra_params
        if self.extra_params.get("connection_uri"):
            return self.extra_params["connection_uri"]

        host = self.host or "localhost"
        port = self.port or 27017

        if self.username and self.password:
            user = urllib.parse.quote_plus(self.username)
            pwd = urllib.parse.quote_plus(self.password)
            auth_db = self.database_name or "admin"
            return f"mongodb://{user}:{pwd}@{host}:{port}/{auth_db}"

        return f"mongodb://{host}:{port}"

    def _get_client(self, timeout_ms: int = 5000) -> MongoClient:
        uri = self._get_connection_uri()
        return MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            socketTimeoutMS=timeout_ms,
        )

    def test_connection(self) -> Dict[str, Any]:
        """Test connectivity and measure ping latency."""
        start_time = time.time()
        try:
            client = self._get_client(timeout_ms=5000)
            # Execute ping command
            ping_result = client.admin.command("ping")
            latency_ms = round((time.time() - start_time) * 1000, 2)

            # Retrieve build info for diagnostic metadata
            build_info = client.admin.command("buildInfo")
            version = build_info.get("version", "unknown")

            client.close()
            return {
                "success": True,
                "message": f"Successfully connected to MongoDB cluster (v{version})",
                "latency_ms": latency_ms,
                "details": {
                    "version": version,
                    "gitVersion": build_info.get("gitVersion"),
                    "ok": ping_result.get("ok"),
                },
            }
        except Exception as e:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": False,
                "message": f"MongoDB connection failed: {str(e)}",
                "latency_ms": latency_ms,
                "details": {"error": str(e)},
            }

    def get_databases(self) -> List[str]:
        """List user databases, filtering out system catalogs unless specifically selected."""
        client = self._get_client()
        try:
            all_dbs = client.list_database_names()
            # If specific database configured, prioritize it
            if self.database_name and self.database_name in all_dbs:
                return [self.database_name]

            # Ignore internal administrative databases
            system_dbs = {"admin", "config", "local"}
            user_dbs = [db for db in all_dbs if db not in system_dbs]
            return user_dbs if user_dbs else all_dbs
        finally:
            client.close()

    def get_schemas(self, database: str) -> List[str]:
        """
        MongoDB is schema-free per database; we standardize on a 'default' schema
        to fit the uniform Connection -> Database -> Schema -> Table -> Column hierarchy.
        """
        return ["default"]

    def get_tables(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """Fetch collections in database and compute collection statistics."""
        client = self._get_client()
        tables = []
        try:
            db = client[database]
            collection_names = db.list_collection_names()

            for col_name in collection_names:
                if col_name.startswith("system."):
                    continue
                col = db[col_name]
                try:
                    count = col.estimated_document_count()
                except Exception:
                    count = 0

                tables.append(
                    {
                        "name": col_name,
                        "table_type": "collection",
                        "row_count": count,
                        "size_bytes": 0,
                        "description": f"MongoDB Collection '{col_name}' with approx. {count} documents",
                        "properties": {
                            "is_capped": False,
                            "storage_engine": "wiredTiger",
                        },
                    }
                )
        finally:
            client.close()
        return tables

    def _infer_bson_type(self, val: Any) -> str:
        if val is None:
            return "null"
        if isinstance(val, ObjectId):
            return "ObjectId"
        if isinstance(val, bool):
            return "boolean"
        if isinstance(val, int):
            return "int64" if abs(val) > 2147483647 else "int32"
        if isinstance(val, float):
            return "double"
        if isinstance(val, str):
            return "string"
        if isinstance(val, datetime):
            return "datetime"
        if isinstance(val, dict):
            return "object"
        if isinstance(val, list):
            return "array"
        if isinstance(val, bytes):
            return "binary"
        return type(val).__name__

    def get_columns(
        self, database: str, schema: str, table: str
    ) -> List[Dict[str, Any]]:
        """
        Inspects documents in the collection to dynamically infer field names,
        data types, primary key (_id), and nullability.
        """
        client = self._get_client()
        columns_map: Dict[str, Dict[str, Any]] = {}
        sample_size = 50

        try:
            db = client[database]
            col = db[table]

            # Sample up to sample_size documents
            sample_docs = list(col.find().limit(sample_size))
            total_sampled = len(sample_docs)

            # Always ensure _id is registered first as primary key
            columns_map["_id"] = {
                "name": "_id",
                "data_type": "ObjectId",
                "is_primary_key": True,
                "is_nullable": False,
                "ordinal_position": 1,
                "description": "MongoDB default primary key identifier",
                "properties": {"indexed": True, "unique": True},
            }

            field_counts: Dict[str, int] = {}
            field_types: Dict[str, Set[str]] = {}

            for doc in sample_docs:
                for k, v in doc.items():
                    field_counts[k] = field_counts.get(k, 0) + 1
                    t = self._infer_bson_type(v)
                    if k not in field_types:
                        field_types[k] = set()
                    field_types[k].add(t)

            position = 2
            for field, types_set in field_types.items():
                if field == "_id":
                    continue
                # If multiple types found across docs, represent as mixed or primary type
                clean_types = [t for t in types_set if t != "null"]
                type_str = "/".join(clean_types) if clean_types else "null"
                nullable = ("null" in types_set) or (
                    field_counts.get(field, 0) < total_sampled
                )

                columns_map[field] = {
                    "name": field,
                    "data_type": type_str or "string",
                    "is_primary_key": False,
                    "is_nullable": nullable,
                    "ordinal_position": position,
                    "description": f"Field inferred from {field_counts.get(field, 0)}/{total_sampled} documents",
                    "properties": {
                        "distinct_types": list(types_set),
                        "presence_ratio": round(
                            field_counts.get(field, 0) / max(total_sampled, 1), 2
                        ),
                    },
                }
                position += 1

        finally:
            client.close()

        return list(columns_map.values())

    @classmethod
    def get_connector_info(cls) -> ConnectorInfo:
        return ConnectorInfo(
            type="mongodb",
            display_name="MongoDB",
            icon="database",
            description="Document-based NoSQL database with flexible BSON schema support.",
            is_active=True,
            default_port=27017,
            fields=[
                ConnectorField(
                    name="name",
                    label="Connection Name",
                    type="text",
                    required=True,
                    placeholder="e.g. Production MongoDB",
                    description="Unique label for this connection",
                ),
                ConnectorField(
                    name="host",
                    label="Host / Server",
                    type="text",
                    required=False,
                    default="localhost",
                    placeholder="e.g. localhost, mongo-server, or cluster.mongodb.net",
                ),
                ConnectorField(
                    name="port",
                    label="Port",
                    type="number",
                    required=False,
                    default=27017,
                    placeholder="27017",
                ),
                ConnectorField(
                    name="database_name",
                    label="Database / Auth Source",
                    type="text",
                    required=False,
                    placeholder="e.g. admin or ecommerce",
                    description="Target database or authentication database",
                ),
                ConnectorField(
                    name="username",
                    label="Username",
                    type="text",
                    required=False,
                    placeholder="Optional database username",
                ),
                ConnectorField(
                    name="password",
                    label="Password",
                    type="password",
                    required=False,
                    placeholder="Optional database password",
                ),
                ConnectorField(
                    name="connection_uri",
                    label="Connection URI (Optional Override)",
                    type="text",
                    required=False,
                    placeholder="mongodb://username:password@host:27017/admin",
                    description="If provided, overrides host, port, and credentials",
                ),
            ],
        )
