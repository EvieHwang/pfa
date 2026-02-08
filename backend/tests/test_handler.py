"""Tests for the Lambda handler."""

import json
import os

import pytest

# Set up test environment before imports
os.environ["PASSWORD_HASH"] = "$2b$12$xDViKv.rRp4BcfMlpp2qW.lZirz6IH79fC8QDvnPAx4BYnEQi.WCi"  # "testpassword"
os.environ["JWT_SECRET"] = "test-jwt-secret"

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
        """Handler should route / to health check."""
        event = {"httpMethod": "GET", "path": "/"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["app"] == "Burn Rate"

    def test_handler_returns_401_for_protected_route(self):
        """Handler should return 401 for protected routes without auth."""
        event = {"httpMethod": "GET", "path": "/transactions"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 401
        body = json.loads(response["body"])
        assert "error" in body

    def test_handler_handles_missing_path(self):
        """Handler should handle events with missing path."""
        event = {"httpMethod": "GET"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200

    def test_handler_options_returns_200(self):
        """Handler should return 200 for OPTIONS requests (CORS preflight)."""
        event = {"httpMethod": "OPTIONS", "path": "/transactions"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200


class TestAuth:
    """Tests for authentication."""

    def test_login_with_valid_password(self):
        """Login should return token with valid password."""
        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"password": "testpassword"}),
        }
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert "token" in body

    def test_login_with_invalid_password(self):
        """Login should return 401 with invalid password."""
        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"password": "wrongpassword"}),
        }
        response = lambda_handler(event, None)
        assert response["statusCode"] == 401

    def test_login_without_password(self):
        """Login should return 400 without password."""
        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({}),
        }
        response = lambda_handler(event, None)
        assert response["statusCode"] == 400


class TestCategories:
    """Tests for categories endpoint."""

    def test_get_categories_requires_auth(self):
        """Categories endpoint should require authentication."""
        event = {"httpMethod": "GET", "path": "/categories"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 401

    def test_get_categories_with_auth(self):
        """Categories endpoint should return categories with valid auth."""
        # First login to get token
        login_event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"password": "testpassword"}),
        }
        login_response = lambda_handler(login_event, None)
        token = json.loads(login_response["body"])["token"]

        # Then get categories
        event = {
            "httpMethod": "GET",
            "path": "/categories",
            "headers": {"Authorization": f"Bearer {token}"},
        }
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert "categories" in body
        assert len(body["categories"]) > 0


class TestAccounts:
    """Tests for accounts endpoint."""

    def test_get_accounts_with_auth(self):
        """Accounts endpoint should return accounts with valid auth."""
        # First login to get token
        login_event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"password": "testpassword"}),
        }
        login_response = lambda_handler(login_event, None)
        token = json.loads(login_response["body"])["token"]

        # Then get accounts
        event = {
            "httpMethod": "GET",
            "path": "/accounts",
            "headers": {"Authorization": f"Bearer {token}"},
        }
        response = lambda_handler(event, None)
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert "accounts" in body
        assert len(body["accounts"]) == 4  # Checking, Savings 1, Savings 2, Credit Card
