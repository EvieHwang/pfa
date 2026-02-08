"""
Tests for the Lambda handler.
"""

import json

from src.handler import lambda_handler


class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_health_check_returns_200(self):
        """Health check should return 200 status code."""
        event = {"httpMethod": "GET", "path": "/health"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200

    def test_health_check_returns_json(self):
        """Health check should return valid JSON body."""
        event = {"httpMethod": "GET", "path": "/health"}
        response = lambda_handler(event, None)
        body = json.loads(response["body"])
        assert "status" in body

    def test_health_check_status_is_healthy(self):
        """Health check should report healthy status."""
        event = {"httpMethod": "GET", "path": "/health"}
        response = lambda_handler(event, None)
        body = json.loads(response["body"])
        assert body["status"] == "healthy"

    def test_health_check_has_cors_header(self):
        """Health check should include CORS headers."""
        event = {"httpMethod": "GET", "path": "/health"}
        response = lambda_handler(event, None)
        assert "Access-Control-Allow-Origin" in response["headers"]


class TestLambdaHandler:
    """Tests for the main Lambda handler."""

    def test_handler_routes_to_health_check(self):
        """Handler should route /health to health check."""
        event = {"httpMethod": "GET", "path": "/health"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "healthy"

    def test_handler_routes_api_health(self):
        """Handler should route /api/health to health check."""
        event = {"httpMethod": "GET", "path": "/api/health"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "healthy"

    def test_handler_routes_root(self):
        """Handler should route / to app info."""
        event = {"httpMethod": "GET", "path": "/"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["app"] == "Burn Rate"

    def test_handler_returns_404_for_unknown_route(self):
        """Handler should return 404 for unknown routes."""
        event = {"httpMethod": "GET", "path": "/transactions"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 404
        body = json.loads(response["body"])
        assert "error" in body

    def test_handler_handles_missing_path(self):
        """Handler should handle events with missing path."""
        event = {"httpMethod": "GET"}
        response = lambda_handler(event, None)
        # Should default to root path and return app info
        assert response["statusCode"] == 200

    def test_handler_options_returns_200(self):
        """Handler should return 200 for OPTIONS requests (CORS preflight)."""
        event = {"httpMethod": "OPTIONS", "path": "/transactions"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
