"""
Apache Airflow DAG: Metadata Ingestion Pipeline
Extracts metadata hierarchy from configured data sources (MongoDB, etc.)
and synchronizes it with the MetaConnect catalog.
"""

from datetime import datetime, timedelta
import logging
import requests
from airflow import DAG
from airflow.operators.python import PythonOperator  # type: ignore

logger = logging.getLogger("airflow.task")


default_args = {
    "owner": "metaconnect",
    "depends_on_past": False,
    "start_date": datetime(2024, 1, 1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=1),
}

dag = DAG(
    "metadata_ingestion_pipeline",
    default_args=default_args,
    description="Automated metadata ingestion pipeline for registered connections",
    schedule_interval=None,  # Triggered on-demand via API or UI
    catchup=False,
    tags=["metadata", "metaconnect", "catalog"],
)


def task_load_and_test_connection(**kwargs):
    """Fetches connection details and performs initial connectivity test."""
    dag_run = kwargs.get("dag_run")
    conf = dag_run.conf if dag_run else {}
    connection_id = conf.get("connection_id")
    run_id = conf.get("run_id")

    logger.info(
        f"Starting ingestion pipeline for connection: {connection_id}, run: {run_id}"
    )
    if not connection_id:
        raise ValueError("Missing 'connection_id' in DAG configuration payload.")

    # Call MetaConnect backend to test connection
    backend_url = "http://backend:8000/api/v1"
    test_resp = requests.post(
        f"{backend_url}/connections/{connection_id}/test", timeout=15
    )

    if test_resp.status_code != 200:
        raise Exception(
            f"Connection test request failed with status {test_resp.status_code}: {test_resp.text}"
        )

    result = test_resp.json()
    if not result.get("success"):
        raise Exception(f"Connection test failed: {result.get('message')}")

    logger.info(f"Connection {connection_id} verified successfully.")
    return {"connection_id": connection_id, "run_id": run_id}


def task_execute_backend_ingestion(**kwargs):
    """Ask the backend to run connector extraction and persist the metadata."""
    ti = kwargs["ti"]
    load_res = ti.xcom_pull(task_ids="validate_connection")
    connection_id = load_res["connection_id"]
    run_id = load_res.get("run_id")

    backend_url = "http://backend:8000/api/v1"
    execute_payload = {"connection_id": connection_id, "run_id": run_id}

    execute_resp = requests.post(
        f"{backend_url}/ingestion/internal/execute",
        json=execute_payload,
        timeout=120,
    )

    if execute_resp.status_code != 200:
        raise Exception(f"Backend ingestion failed: {execute_resp.text}")

    logger.info("Backend metadata ingestion completed successfully!")
    return execute_resp.json()


# Define tasks
t1 = PythonOperator(
    task_id="validate_connection",
    python_callable=task_load_and_test_connection,
    provide_context=True,
    dag=dag,
)

t2 = PythonOperator(
    task_id="execute_backend_ingestion",
    python_callable=task_execute_backend_ingestion,
    provide_context=True,
    dag=dag,
)

t1 >> t2
