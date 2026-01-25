"""Authentication module for PFA - handles JWT and password validation."""

import os
import json
import jwt
import bcrypt
import boto3
from datetime import datetime, timedelta
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Constants
TOKEN_EXPIRY_HOURS = 24
JWT_ALGORITHM = "HS256"

# Cached secrets
_secrets_cache: Optional[dict] = None


def get_secrets() -> dict:
    """Get secrets from AWS Secrets Manager."""
    global _secrets_cache

    if _secrets_cache is not None:
        return _secrets_cache

    secret_name = os.environ.get('SECRET_NAME', 'pfa/prod')
    region = os.environ.get('AWS_REGION_NAME', 'us-east-1')

    client = boto3.client('secretsmanager', region_name=region)

    try:
        response = client.get_secret_value(SecretId=secret_name)
        _secrets_cache = json.loads(response['SecretString'])
        return _secrets_cache
    except Exception as e:
        logger.error(f"Failed to get secrets: {e}")
        raise


def get_password_hash() -> str:
    """Get the bcrypt password hash from secrets."""
    secrets = get_secrets()
    return secrets.get('PASSWORD_HASH', '')


def get_jwt_secret() -> str:
    """Get the JWT signing secret from secrets."""
    secrets = get_secrets()
    return secrets.get('JWT_SECRET', '')


def validate_password(password: str) -> bool:
    """Validate password against stored bcrypt hash."""
    try:
        stored_hash = get_password_hash()
        if not stored_hash:
            logger.error("No password hash configured")
            return False

        # bcrypt.checkpw expects bytes
        return bcrypt.checkpw(
            password.encode('utf-8'),
            stored_hash.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password validation error: {e}")
        return False


def create_token() -> Tuple[str, datetime]:
    """Create a new JWT token."""
    secret = get_jwt_secret()
    if not secret:
        raise ValueError("JWT secret not configured")

    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)

    payload = {
        "sub": "pfa_user",
        "iat": datetime.utcnow(),
        "exp": expires_at
    }

    token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    return token, expires_at


def verify_token(token: str) -> Tuple[bool, Optional[datetime]]:
    """Verify a JWT token.

    Returns:
        Tuple of (is_valid, expires_at)
    """
    try:
        secret = get_jwt_secret()
        if not secret:
            return False, None

        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        expires_at = datetime.fromtimestamp(payload['exp'])

        return True, expires_at
    except jwt.ExpiredSignatureError:
        logger.info("Token expired")
        return False, None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return False, None


def extract_token_from_header(authorization: str) -> Optional[str]:
    """Extract JWT token from Authorization header.

    Expected format: "Bearer <token>"
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None

    return parts[1]


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    This is a utility function for generating password hashes.
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')
