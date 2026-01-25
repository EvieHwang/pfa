"""Database module for PFA - handles SQLite with S3 storage."""

import logging
import os
import sqlite3
from pathlib import Path

import boto3

logger = logging.getLogger(__name__)

# Constants
LOCAL_DB_PATH = "/tmp/pfa.db"
DB_FILENAME = "pfa.db"

# Global connection cache
_connection: sqlite3.Connection | None = None
_db_loaded = False


def get_s3_client():
    """Get boto3 S3 client."""
    return boto3.client('s3', region_name=os.environ.get('AWS_REGION_NAME', 'us-east-1'))


def get_data_bucket() -> str:
    """Get the data bucket name from environment."""
    return os.environ.get('DATA_BUCKET', 'pfa-data-prod')


def download_database() -> bool:
    """Download database from S3 to local temp storage."""
    global _db_loaded

    bucket = get_data_bucket()
    s3 = get_s3_client()

    try:
        s3.download_file(bucket, DB_FILENAME, LOCAL_DB_PATH)
        logger.info(f"Downloaded database from s3://{bucket}/{DB_FILENAME}")
        _db_loaded = True
        return True
    except s3.exceptions.ClientError as e:
        if e.response['Error']['Code'] == '404':
            logger.info("No existing database found in S3, will create new one")
            _db_loaded = False
            return False
        raise


def upload_database() -> None:
    """Upload database from local temp storage to S3."""
    if not os.path.exists(LOCAL_DB_PATH):
        logger.warning("No local database to upload")
        return

    bucket = get_data_bucket()
    s3 = get_s3_client()

    s3.upload_file(LOCAL_DB_PATH, bucket, DB_FILENAME)
    logger.info(f"Uploaded database to s3://{bucket}/{DB_FILENAME}")


def get_connection() -> sqlite3.Connection:
    """Get SQLite database connection, downloading from S3 if needed."""
    global _connection, _db_loaded

    if _connection is not None:
        return _connection

    # Try to download from S3 if not already loaded
    if not _db_loaded and not os.path.exists(LOCAL_DB_PATH):
        download_database()

    # Connect to database (creates if not exists)
    _connection = sqlite3.connect(LOCAL_DB_PATH)
    _connection.row_factory = sqlite3.Row

    # Enable foreign keys
    _connection.execute("PRAGMA foreign_keys = ON")

    # Initialize schema if new database
    if not _db_loaded:
        init_schema(_connection)
        upload_database()
        _db_loaded = True

    return _connection


def init_schema(conn: sqlite3.Connection | None = None) -> None:
    """Initialize database schema from schema.sql."""
    if conn is None:
        conn = get_connection()

    # Get schema file path
    schema_path = Path(__file__).parent / "schema.sql"

    with open(schema_path) as f:
        schema_sql = f.read()

    # Execute schema
    conn.executescript(schema_sql)
    conn.commit()
    logger.info("Database schema initialized")


def close_connection() -> None:
    """Close the database connection."""
    global _connection

    if _connection is not None:
        _connection.close()
        _connection = None


def save_and_close() -> None:
    """Save database to S3 and close connection."""
    global _connection

    if _connection is not None:
        _connection.commit()
        _connection.close()
        _connection = None

    upload_database()


def execute_query(query: str, params: tuple = ()) -> sqlite3.Cursor:
    """Execute a query and return cursor."""
    conn = get_connection()
    return conn.execute(query, params)


def execute_many(query: str, params_list: list) -> None:
    """Execute a query with multiple parameter sets."""
    conn = get_connection()
    conn.executemany(query, params_list)


def commit() -> None:
    """Commit current transaction."""
    conn = get_connection()
    conn.commit()


def fetch_one(query: str, params: tuple = ()) -> tuple | None:
    """Execute query and fetch one result."""
    cursor = execute_query(query, params)
    return cursor.fetchone()


def fetch_all(query: str, params: tuple = ()) -> list:
    """Execute query and fetch all results."""
    cursor = execute_query(query, params)
    return cursor.fetchall()


# Context manager for database operations that need to save
class DatabaseSession:
    """Context manager that saves to S3 on exit."""

    def __enter__(self):
        return get_connection()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            # No exception, commit and upload
            commit()
            upload_database()
        else:
            # Exception occurred, just close
            close_connection()
        return False
