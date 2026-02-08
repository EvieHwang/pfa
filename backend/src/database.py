"""SQLite database with S3 sync for persistent storage."""

import logging
import os
import sqlite3
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Global connection
_connection: sqlite3.Connection | None = None
_db_path: str | None = None

# S3 configuration
DATA_BUCKET = os.environ.get("DATA_BUCKET", "")
DB_KEY = "burn-rate.db"


def get_db_path() -> str:
    """Get the path to the SQLite database file."""
    global _db_path
    if _db_path is None:
        # Use /tmp in Lambda, local file otherwise
        if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            _db_path = "/tmp/burn-rate.db"
        else:
            _db_path = str(Path(__file__).parent.parent / "burn-rate.db")
    return _db_path


def download_database() -> bool:
    """Download database from S3 if it exists."""
    if not DATA_BUCKET:
        logger.info("No DATA_BUCKET configured, using local database")
        return False

    try:
        s3 = boto3.client("s3")
        db_path = get_db_path()
        s3.download_file(DATA_BUCKET, DB_KEY, db_path)
        logger.info(f"Downloaded database from s3://{DATA_BUCKET}/{DB_KEY}")
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            logger.info("No existing database in S3, will create new one")
            return False
        raise


def upload_database() -> bool:
    """Upload database to S3."""
    if not DATA_BUCKET:
        logger.info("No DATA_BUCKET configured, skipping upload")
        return False

    try:
        s3 = boto3.client("s3")
        db_path = get_db_path()
        s3.upload_file(db_path, DATA_BUCKET, DB_KEY)
        logger.info(f"Uploaded database to s3://{DATA_BUCKET}/{DB_KEY}")
        return True
    except ClientError as e:
        logger.error(f"Failed to upload database: {e}")
        raise


def get_connection() -> sqlite3.Connection:
    """Get or create database connection."""
    global _connection

    if _connection is not None:
        return _connection

    db_path = get_db_path()

    # Try to download from S3 if file doesn't exist locally
    if not os.path.exists(db_path):
        download_database()

    # Connect and enable foreign keys
    _connection = sqlite3.connect(db_path)
    _connection.row_factory = sqlite3.Row
    _connection.execute("PRAGMA foreign_keys = ON")

    # Initialize schema if needed
    _init_schema(_connection)

    return _connection


def _init_schema(conn: sqlite3.Connection) -> None:
    """Initialize database schema if tables don't exist."""
    # Check if accounts table exists
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
    )
    if cursor.fetchone() is not None:
        return  # Schema already exists

    logger.info("Initializing database schema")
    schema_path = Path(__file__).parent / "schema.sql"
    if schema_path.exists():
        with open(schema_path) as f:
            conn.executescript(f.read())
        conn.commit()
        logger.info("Schema initialized successfully")
    else:
        logger.warning("schema.sql not found, database will be empty")


def execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    """Execute a SQL statement."""
    conn = get_connection()
    return conn.execute(sql, params)


def executemany(sql: str, params_list: list[tuple]) -> sqlite3.Cursor:
    """Execute a SQL statement with multiple parameter sets."""
    conn = get_connection()
    return conn.executemany(sql, params_list)


def fetchone(sql: str, params: tuple = ()) -> sqlite3.Row | None:
    """Execute and fetch one result."""
    cursor = execute(sql, params)
    return cursor.fetchone()


def fetchall(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    """Execute and fetch all results."""
    cursor = execute(sql, params)
    return cursor.fetchall()


def commit() -> None:
    """Commit the current transaction."""
    if _connection is not None:
        _connection.commit()


def close() -> None:
    """Close the database connection."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None


def dict_from_row(row: sqlite3.Row | None) -> dict | None:
    """Convert a Row to a dict."""
    if row is None:
        return None
    return dict(row)


def dicts_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    """Convert a list of Rows to a list of dicts."""
    return [dict(row) for row in rows]
