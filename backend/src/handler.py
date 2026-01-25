"""Lambda handler for PFA API."""

import json
import logging
import traceback
from typing import Any, Callable, Dict, Optional
from functools import wraps

from . import auth
from . import database

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Route registry
_routes: Dict[str, Dict[str, Callable]] = {}


def route(path: str, method: str = "GET", requires_auth: bool = True):
    """Decorator to register a route handler."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        # Store auth requirement on the function
        wrapper._requires_auth = requires_auth

        # Register route
        if path not in _routes:
            _routes[path] = {}
        _routes[path][method.upper()] = wrapper

        return wrapper
    return decorator


def json_response(status_code: int, body: Any, headers: Optional[Dict] = None) -> Dict:
    """Create a JSON API response."""
    response_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    }
    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body) if body is not None else ""
    }


def error_response(status_code: int, message: str, code: str = None) -> Dict:
    """Create an error response."""
    body = {"error": message}
    if code:
        body["code"] = code
    return json_response(status_code, body)


def parse_body(event: Dict) -> Optional[Dict]:
    """Parse JSON body from event."""
    body = event.get("body")
    if not body:
        return None

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def get_path_params(event: Dict) -> Dict:
    """Get path parameters from event."""
    return event.get("pathParameters") or {}


def get_query_params(event: Dict) -> Dict:
    """Get query string parameters from event."""
    return event.get("queryStringParameters") or {}


def check_auth(event: Dict) -> bool:
    """Check if request is authenticated."""
    headers = event.get("headers") or {}

    # Headers can be case-insensitive
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if not auth_header:
        return False

    token = auth.extract_token_from_header(auth_header)
    if not token:
        return False

    is_valid, _ = auth.verify_token(token)
    return is_valid


def lambda_handler(event: Dict, context: Any) -> Dict:
    """Main Lambda entry point."""
    try:
        # Get request info
        http_method = event.get("httpMethod", "GET")
        path = event.get("path", "/")

        logger.info(f"Request: {http_method} {path}")

        # Handle CORS preflight
        if http_method == "OPTIONS":
            return json_response(200, None)

        # Normalize path (remove trailing slash, handle /api prefix)
        normalized_path = path.rstrip("/")
        if normalized_path.startswith("/api"):
            normalized_path = normalized_path[4:]  # Remove /api prefix

        # Health check
        if normalized_path == "/health" or normalized_path == "":
            if normalized_path == "/health":
                return json_response(200, {"status": "healthy"})
            # Root path
            if http_method == "GET":
                return json_response(200, {
                    "app": "PFA",
                    "version": "1.0.0",
                    "status": "running"
                })

        # Find matching route
        handler = None
        path_params = {}

        # Try exact match first
        if normalized_path in _routes and http_method in _routes[normalized_path]:
            handler = _routes[normalized_path][http_method]
        else:
            # Try pattern matching for parameterized routes
            for route_path, methods in _routes.items():
                if http_method not in methods:
                    continue

                # Check if route has parameters (e.g., /transactions/{id})
                if "{" in route_path:
                    route_parts = route_path.split("/")
                    path_parts = normalized_path.split("/")

                    if len(route_parts) == len(path_parts):
                        match = True
                        params = {}
                        for r_part, p_part in zip(route_parts, path_parts):
                            if r_part.startswith("{") and r_part.endswith("}"):
                                param_name = r_part[1:-1]
                                params[param_name] = p_part
                            elif r_part != p_part:
                                match = False
                                break

                        if match:
                            handler = methods[http_method]
                            path_params = params
                            break

        if not handler:
            return error_response(404, f"Not found: {http_method} {path}", "NOT_FOUND")

        # Check authentication if required
        if getattr(handler, '_requires_auth', True) and not check_auth(event):
            return error_response(401, "Authentication required", "UNAUTHORIZED")

        # Call handler
        event["_path_params"] = path_params
        result = handler(event)

        # Ensure database changes are saved
        if http_method in ["POST", "PUT", "PATCH", "DELETE"]:
            database.commit()
            database.upload_database()

        return result

    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        logger.error(traceback.format_exc())
        return error_response(500, "Internal server error", "INTERNAL_ERROR")


# Import route modules to register routes
from .routes import auth_routes
from .routes import transaction_routes
from .routes import category_routes
from .routes import rule_routes
from .routes import budget_routes
from .routes import dashboard_routes
