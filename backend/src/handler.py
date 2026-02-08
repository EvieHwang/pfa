"""Lambda handler for Burn Rate API."""

import json
import logging
from typing import Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def json_response(status_code: int, body: Any) -> dict:
    """Create a JSON API response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body) if body is not None else ""
    }


def lambda_handler(event: dict, context: Any) -> dict:
    """Main Lambda entry point."""
    http_method = event.get("httpMethod", "GET")
    path = event.get("path", "/")

    logger.info(f"Request: {http_method} {path}")

    # Handle CORS preflight
    if http_method == "OPTIONS":
        return json_response(200, None)

    # Normalize path
    normalized_path = path.rstrip("/")
    if normalized_path.startswith("/api"):
        normalized_path = normalized_path[4:]

    # Health check
    if normalized_path in ["/health", ""]:
        return json_response(200, {
            "status": "healthy",
            "app": "Burn Rate",
            "version": "2.0.0"
        })

    # All other routes return 404 for now
    return json_response(404, {"error": "Not found"})
