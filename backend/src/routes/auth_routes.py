"""Authentication routes for PFA API."""

from .. import auth
from ..handler import error_response, json_response, parse_body, route


@route("/auth/login", method="POST", requires_auth=False)
def login(event):
    """Authenticate user and return JWT token."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    password = body.get("password")
    if not password:
        return error_response(400, "Password required", "BAD_REQUEST")

    # Validate password
    if not auth.validate_password(password):
        return error_response(401, "Invalid password", "UNAUTHORIZED")

    # Generate token
    try:
        token, expires_at = auth.create_token()
        return json_response(200, {
            "token": token,
            "expires_at": expires_at.isoformat()
        })
    except Exception as e:
        return error_response(500, f"Failed to create token: {str(e)}", "INTERNAL_ERROR")


@route("/auth/verify", method="GET", requires_auth=True)
def verify(event):
    """Verify that the current token is valid."""
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization")

    token = auth.extract_token_from_header(auth_header)
    if not token:
        return error_response(401, "No token provided", "UNAUTHORIZED")

    is_valid, expires_at = auth.verify_token(token)

    if not is_valid:
        return error_response(401, "Invalid or expired token", "UNAUTHORIZED")

    return json_response(200, {
        "valid": True,
        "expires_at": expires_at.isoformat() if expires_at else None
    })
