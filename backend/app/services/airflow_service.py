import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import requests
from requests.auth import HTTPBasicAuth
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.connection import Connection
from app.models.ingestion import IngestionRun
from app.schemas.ingestion import IngestionTriggerResponse, IngestionRunResponse
from app.schemas.metadata import MetadataSyncPayload
from app.core.security import decrypt_secret
from app.connectors.registry import ConnectorRegistry
from app.services.metadata_service import MetadataService

logger = logging.getLogger(__name__)


class AirflowService:

    @classmethod
    def _get_live_airflow_state(cls, dag_run_id: Optional[str]) -> Optional[str]:
        """Read the current Airflow state for an Airflow-backed ingestion run."""
        if not dag_run_id or not dag_run_id.startswith("manual__"):
            return None

        airflow_url = (
            f"{settings.AIRFLOW_BASE_URL}/api/v1/dags/"
            f"{settings.AIRFLOW_DAG_ID}/dagRuns/{dag_run_id}"
        )
        try:
            response = requests.get(
                airflow_url,
                auth=HTTPBasicAuth(
                    settings.AIRFLOW_USERNAME, settings.AIRFLOW_PASSWORD
                ),
                timeout=3,
            )
            if response.status_code == 200:
                return response.json().get("state")
            logger.warning(
                "Could not read Airflow DAG state: HTTP %s",
                response.status_code,
            )
        except requests.RequestException as exc:
            logger.warning("Could not read Airflow DAG state: %s", exc)
        return None

    @classmethod
    def _synchronize_run_status(cls, db: Session, run: IngestionRun) -> Optional[str]:
        """Synchronize the stored run status with the live Airflow state."""
        airflow_state = cls._get_live_airflow_state(run.dag_run_id)
        if airflow_state in {"success", "failed"} and run.status == "RUNNING":
            run.status = "SUCCESS" if airflow_state == "success" else "FAILED"
            run.completed_at = run.completed_at or datetime.now(timezone.utc)
            if airflow_state == "failed" and not run.error_message:
                run.error_message = "Airflow DAG run failed. Check Airflow task logs."
            db.commit()
        return airflow_state

    @classmethod
    def trigger_ingestion(
        cls, db: Session, connection_id: uuid.UUID
    ) -> IngestionTriggerResponse:
        """
        Initiates a metadata ingestion pipeline for a connection.
        Creates an IngestionRun tracking record, then triggers the Airflow DAG.
        Airflow is required; ingestion fails if the DAG cannot be triggered.
        """
        conn = db.query(Connection).filter(Connection.id == connection_id).first()
        if not conn:
            raise ValueError(f"Connection {connection_id} not found")

        # Create ingestion run entry in DB
        run = IngestionRun(
            connection_id=conn.id,
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
            stats={"stage": "initializing"},
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        # Trigger Airflow REST API. Airflow is the only execution path.
        dag_run_id = f"manual__{run.id}"

        try:
            airflow_url = f"{settings.AIRFLOW_BASE_URL}/api/v1/dags/{settings.AIRFLOW_DAG_ID}/dagRuns"
            auth = HTTPBasicAuth(settings.AIRFLOW_USERNAME, settings.AIRFLOW_PASSWORD)
            payload = {
                "dag_run_id": dag_run_id,
                "conf": {
                    "connection_id": str(conn.id),
                    "connection_name": conn.name,
                    "connector_type": conn.connector_type,
                    "run_id": str(run.id),
                },
            }
            logger.info(f"Posting to Airflow DAG at: {airflow_url}")
            resp = requests.post(airflow_url, json=payload, auth=auth, timeout=3)
            if resp.status_code not in (200, 201):
                raise RuntimeError(
                    f"Airflow returned HTTP {resp.status_code}: {resp.text}"
                )
            run.dag_run_id = dag_run_id
            db.commit()
            logger.info(f"Airflow DAG triggered successfully: {dag_run_id}")
        except Exception as exc:
            run.status = "FAILED"
            run.error_message = f"Could not trigger Airflow DAG: {exc}"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.error(run.error_message)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Airflow is unavailable. Ingestion was not started.",
            ) from exc

        return IngestionTriggerResponse(
            success=True,
            message="Metadata ingestion pipeline triggered successfully.",
            run_id=run.id,
            dag_run_id=run.dag_run_id,
            status="RUNNING",
        )

    @classmethod
    def execute_ingestion(
        cls, db: Session, connection_id: uuid.UUID, run_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Run the shared connector extraction and persist its metadata."""
        try:
            conn = db.query(Connection).filter(Connection.id == connection_id).first()
            if not conn:
                raise ValueError(f"Connection {connection_id} not found")

            raw_pwd = decrypt_secret(conn.password_encrypted)
            config = {
                "host": conn.host,
                "port": conn.port,
                "database_name": conn.database_name,
                "username": conn.username,
                "password": raw_pwd,
                "extra_params": conn.extra_params or {},
            }

            logger.info(
                f"Extracting metadata for {conn.name} ({conn.connector_type})..."
            )
            connector = ConnectorRegistry.instantiate(conn.connector_type, config)
            test_res = connector.test_connection()
            if not test_res.get("success"):
                raise RuntimeError(
                    f"Connectivity check failed: {test_res.get('message')}"
                )

            extracted_dbs = connector.extract_all()
            logger.info(f"Extracted {len(extracted_dbs)} databases from {conn.name}.")

            sync_payload = MetadataSyncPayload(
                connection_id=conn.id,
                run_id=run_id,
                databases=extracted_dbs,
                status="SUCCESS",
            )
            result = MetadataService.sync_metadata(db, sync_payload)
            logger.info(f"Metadata ingestion completed successfully for {conn.name}.")
            return result
        except Exception as e:
            db.rollback()
            run = db.query(IngestionRun).filter(IngestionRun.id == run_id).first()
            if run:
                run.status = "FAILED"
                run.error_message = str(e)
                run.completed_at = datetime.now(timezone.utc)
                db.commit()
            raise

    @classmethod
    def get_run_status(cls, db: Session, run_id: uuid.UUID) -> IngestionRunResponse:
        run = db.query(IngestionRun).filter(IngestionRun.id == run_id).first()
        if not run:
            raise ValueError(f"Ingestion run {run_id} not found")

        airflow_state = cls._synchronize_run_status(db, run)

        conn = db.query(Connection).filter(Connection.id == run.connection_id).first()
        return IngestionRunResponse(
            id=run.id,
            connection_id=run.connection_id,
            connection_name=conn.name if conn else None,
            connector_type=conn.connector_type if conn else None,
            dag_run_id=run.dag_run_id,
            status=run.status,
            airflow_state=airflow_state,
            started_at=run.started_at,
            completed_at=run.completed_at,
            error_message=run.error_message,
            stats=run.stats or {},
            created_at=run.created_at,
        )

    @classmethod
    def get_connection_history(
        cls, db: Session, connection_id: uuid.UUID
    ) -> list[IngestionRunResponse]:
        runs = (
            db.query(IngestionRun)
            .filter(IngestionRun.connection_id == connection_id)
            .order_by(IngestionRun.started_at.desc())
            .all()
        )

        conn = db.query(Connection).filter(Connection.id == connection_id).first()
        conn_name = conn.name if conn else None
        conn_type = conn.connector_type if conn else None

        return [
            IngestionRunResponse(
                id=r.id,
                connection_id=r.connection_id,
                connection_name=conn_name,
                connector_type=conn_type,
                dag_run_id=r.dag_run_id,
                status=r.status,
                started_at=r.started_at,
                completed_at=r.completed_at,
                error_message=r.error_message,
                stats=r.stats or {},
                created_at=r.created_at,
            )
            for r in runs
        ]

    @classmethod
    def get_all_runs(cls, db: Session, limit: int = 20) -> list[IngestionRunResponse]:
        runs = (
            db.query(IngestionRun)
            .order_by(IngestionRun.started_at.desc())
            .limit(limit)
            .all()
        )
        result = []
        for r in runs:
            conn = db.query(Connection).filter(Connection.id == r.connection_id).first()
            result.append(
                IngestionRunResponse(
                    id=r.id,
                    connection_id=r.connection_id,
                    connection_name=conn.name if conn else None,
                    connector_type=conn.connector_type if conn else None,
                    dag_run_id=r.dag_run_id,
                    status=r.status,
                    started_at=r.started_at,
                    completed_at=r.completed_at,
                    error_message=r.error_message,
                    stats=r.stats or {},
                    created_at=r.created_at,
                )
            )
        return result
