"""Password-only authentication with JWT tokens."""

import hashlib
import hmac
import json
import logging
import os
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# JWT configuration
JWT_EXPIRY_HOURS = 24
JWT_ALGORITHM = "HS256"

# Cached secrets
_secrets_cache: dict | None = None


def _get_secrets() -> dict:
    """Get secrets from AWS Secrets Manager (cached)."""
    global _secrets_cache

    if _secrets_cache is not None:
        return _secrets_cache

    secret_name = os.environ.get("SECRET_NAME", "pfa/prod")

    # For local development, check environment variables
    if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        password_hash = os.environ.get("PASSWORD_HASH", "")
        jwt_secret = os.environ.get("JWT_SECRET", "dev-secret-change-me")
        if password_hash:
            _secrets_cache = {
                "PASSWORD_HASH": password_hash,
                "JWT_SECRET": jwt_secret,
            }
            return _secrets_cache

    try:
        client = boto3.client("secretsmanager")
        response = client.get_secret_value(SecretId=secret_name)
        _secrets_cache = json.loads(response["SecretString"])
        return _secrets_cache
    except ClientError as e:
        logger.error(f"Failed to get secrets: {e}")
        raise


def verify_password(password: str) -> bool:
    """Verify the password against stored bcrypt hash."""
    import bcrypt

    secrets = _get_secrets()
    stored_hash = secrets.get("PASSWORD_HASH", "")

    if not stored_hash:
        logger.error("No PASSWORD_HASH configured")
        return False

    try:
        return bcrypt.checkpw(password.encode(), stored_hash.encode())
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def generate_token() -> str:
    """Generate a JWT token."""
    secrets = _get_secrets()
    jwt_secret = secrets.get("JWT_SECRET", "")

    if not jwt_secret:
        raise ValueError("No JWT_SECRET configured")

    # Create header and payload
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600),
    }

    # Encode header and payload
    header_b64 = urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    payload_b64 = urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()

    # Create signature
    message = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        jwt_secret.encode(), message.encode(), hashlib.sha256
    ).digest()
    signature_b64 = urlsafe_b64encode(signature).rstrip(b"=").decode()

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def verify_token(token: str) -> tuple[bool, dict | None]:
    """Verify a JWT token. Returns (is_valid, payload)."""
    secrets = _get_secrets()
    jwt_secret = secrets.get("JWT_SECRET", "")

    if not jwt_secret:
        return False, None

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, None

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        message = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            jwt_secret.encode(), message.encode(), hashlib.sha256
        ).digest()
        expected_sig_b64 = urlsafe_b64encode(expected_sig).rstrip(b"=").decode()

        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return False, None

        # Decode payload
        # Add padding if needed
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding

        payload = json.loads(urlsafe_b64decode(payload_b64))

        # Check expiration
        if payload.get("exp", 0) < time.time():
            return False, None

        return True, payload

    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return False, None


def extract_token_from_header(auth_header: str) -> str | None:
    """Extract token from Authorization header."""
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]
