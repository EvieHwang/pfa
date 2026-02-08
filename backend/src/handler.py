"""Lambda handler for Burn Rate API."""

import base64
import json
import logging
import traceback
from typing import Any

from . import auth, csv_parser, database

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def json_response(status_code: int, body: Any, headers: dict | None = None) -> dict:
    """Create a JSON API response."""
    response_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body) if body is not None else "",
    }


def error_response(status_code: int, message: str, code: str | None = None) -> dict:
    """Create an error response."""
    body = {"error": message}
    if code:
        body["code"] = code
    return json_response(status_code, body)


def parse_body(event: dict) -> dict | None:
    """Parse JSON body from event."""
    body = event.get("body")
    if not body:
        return None

    # Handle base64 encoded body
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def check_auth(event: dict) -> bool:
    """Check if request is authenticated."""
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization")

    if not auth_header:
        return False

    token = auth.extract_token_from_header(auth_header)
    if not token:
        return False

    is_valid, _ = auth.verify_token(token)
    return is_valid


def lambda_handler(event: dict, context: Any) -> dict:
    """Main Lambda entry point."""
    try:
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

        # Route to handlers
        if normalized_path in ["/health", ""]:
            return handle_health(event)

        if normalized_path == "/auth/login" and http_method == "POST":
            return handle_login(event)

        # All other routes require authentication
        if not check_auth(event):
            return error_response(401, "Authentication required", "UNAUTHORIZED")

        # Transaction routes
        if normalized_path == "/transactions/upload" and http_method == "POST":
            return handle_upload(event)

        if normalized_path == "/transactions" and http_method == "GET":
            return handle_get_transactions(event)

        if normalized_path == "/transactions/review-queue" and http_method == "GET":
            return handle_review_queue(event)

        if normalized_path.startswith("/transactions/") and http_method == "PUT":
            # Extract transaction ID
            parts = normalized_path.split("/")
            if len(parts) >= 3 and parts[2].isdigit():
                if len(parts) == 4 and parts[3] == "categorize":
                    return handle_categorize(event, int(parts[2]))

        # Category routes
        if normalized_path == "/categories" and http_method == "GET":
            return handle_get_categories(event)

        # Account routes
        if normalized_path == "/accounts" and http_method == "GET":
            return handle_get_accounts(event)

        # Status route (for iOS)
        if normalized_path == "/status" and http_method == "GET":
            return handle_status(event)

        return error_response(404, f"Not found: {http_method} {path}", "NOT_FOUND")

    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        logger.error(traceback.format_exc())
        return error_response(500, "Internal server error", "INTERNAL_ERROR")


# --- Route Handlers ---


def handle_health(event: dict) -> dict:
    """Health check endpoint."""
    return json_response(
        200,
        {
            "status": "healthy",
            "app": "Burn Rate",
            "version": "2.0.0",
        },
    )


def handle_login(event: dict) -> dict:
    """Handle login request."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    password = body.get("password")
    if not password:
        return error_response(400, "Password required")

    if not auth.verify_password(password):
        return error_response(401, "Invalid password", "INVALID_PASSWORD")

    token = auth.generate_token()
    return json_response(200, {"token": token})


def handle_upload(event: dict) -> dict:
    """Handle CSV upload."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    account_id = body.get("account_id")
    csv_content = body.get("csv_content")

    if not account_id or not csv_content:
        return error_response(400, "account_id and csv_content required")

    # Verify account exists
    account = database.fetchone(
        "SELECT * FROM accounts WHERE id = ?", (account_id,)
    )
    if not account:
        return error_response(404, "Account not found")

    try:
        # Parse CSV
        transactions = csv_parser.parse_csv(csv_content, account["csv_format"])
    except csv_parser.CSVParseError as e:
        return error_response(400, f"CSV parse error: {e}")

    # Insert transactions, skipping duplicates
    new_count = 0
    duplicate_count = 0

    for txn in transactions:
        # Check for duplicate
        existing = database.fetchone(
            "SELECT id FROM transactions WHERE dedup_hash = ?", (txn.dedup_hash,)
        )
        if existing:
            duplicate_count += 1
            continue

        # Insert new transaction
        database.execute(
            """
            INSERT INTO transactions
            (account_id, date, description, amount, reference_number, dedup_hash, needs_review)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                account_id,
                txn.date,
                txn.description,
                txn.amount,
                txn.reference_number,
                txn.dedup_hash,
            ),
        )
        new_count += 1

    # Apply auto-categorization rules to new transactions
    rules = database.fetchall("SELECT * FROM rules ORDER BY priority ASC")
    categorized_count = 0

    if rules and new_count > 0:
        # Get uncategorized transactions
        uncategorized = database.fetchall(
            "SELECT id, description FROM transactions WHERE needs_review = 1"
        )
        for txn in uncategorized:
            for rule in rules:
                if rule["pattern"].lower() in txn["description"].lower():
                    # Check account filter
                    if rule["account_filter"] and rule["account_filter"] != account_id:
                        continue
                    # Apply category
                    database.execute(
                        "UPDATE transactions SET category_id = ?, needs_review = 0 WHERE id = ?",
                        (rule["category_id"], txn["id"]),
                    )
                    categorized_count += 1
                    break

    database.commit()
    database.upload_database()

    # Count remaining needs_review
    needs_review = database.fetchone(
        "SELECT COUNT(*) as count FROM transactions WHERE needs_review = 1"
    )

    return json_response(
        200,
        {
            "new_count": new_count,
            "duplicate_count": duplicate_count,
            "categorized_count": categorized_count,
            "needs_review_count": needs_review["count"] if needs_review else 0,
        },
    )


def handle_get_transactions(event: dict) -> dict:
    """Get transactions with optional filters."""
    params = event.get("queryStringParameters") or {}

    # Build query
    query = "SELECT t.*, c.name as category_name, a.name as account_name FROM transactions t"
    query += " LEFT JOIN categories c ON t.category_id = c.id"
    query += " LEFT JOIN accounts a ON t.account_id = a.id"
    query += " WHERE 1=1"

    query_params = []

    # Apply filters
    if params.get("account_id"):
        query += " AND t.account_id = ?"
        query_params.append(params["account_id"])

    if params.get("category_id"):
        query += " AND t.category_id = ?"
        query_params.append(params["category_id"])

    if params.get("needs_review"):
        query += " AND t.needs_review = ?"
        query_params.append(1 if params["needs_review"].lower() == "true" else 0)

    if params.get("start_date"):
        query += " AND t.date >= ?"
        query_params.append(params["start_date"])

    if params.get("end_date"):
        query += " AND t.date <= ?"
        query_params.append(params["end_date"])

    query += " ORDER BY t.date DESC, t.id DESC"

    # Apply limit
    limit = min(int(params.get("limit", 100)), 1000)
    offset = int(params.get("offset", 0))
    query += f" LIMIT {limit} OFFSET {offset}"

    transactions = database.fetchall(query, tuple(query_params))

    return json_response(200, {"transactions": database.dicts_from_rows(transactions)})


def handle_review_queue(event: dict) -> dict:
    """Get transactions needing review."""
    transactions = database.fetchall(
        """
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.needs_review = 1
        ORDER BY t.date DESC, t.id DESC
        LIMIT 100
        """
    )

    return json_response(200, {"transactions": database.dicts_from_rows(transactions)})


def handle_categorize(event: dict, transaction_id: int) -> dict:
    """Categorize a transaction."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    category_id = body.get("category_id")
    create_rule = body.get("create_rule", False)

    if category_id is None:
        return error_response(400, "category_id required")

    # Verify transaction exists
    txn = database.fetchone(
        "SELECT * FROM transactions WHERE id = ?", (transaction_id,)
    )
    if not txn:
        return error_response(404, "Transaction not found")

    # Verify category exists
    if category_id:
        category = database.fetchone(
            "SELECT * FROM categories WHERE id = ?", (category_id,)
        )
        if not category:
            return error_response(404, "Category not found")

    # Update transaction
    database.execute(
        "UPDATE transactions SET category_id = ?, needs_review = 0 WHERE id = ?",
        (category_id, transaction_id),
    )

    # Optionally create a rule
    if create_rule and category_id:
        # Use first 30 chars of description as pattern
        pattern = txn["description"][:30].strip()
        # Check if similar rule already exists
        existing_rule = database.fetchone(
            "SELECT id FROM rules WHERE pattern = ?", (pattern,)
        )
        if not existing_rule:
            database.execute(
                "INSERT INTO rules (pattern, category_id, priority) VALUES (?, ?, 100)",
                (pattern, category_id),
            )

    database.commit()
    database.upload_database()

    return json_response(200, {"success": True})


def handle_get_categories(event: dict) -> dict:
    """Get all categories."""
    categories = database.fetchall(
        "SELECT * FROM categories ORDER BY burn_rate_group, parent_id, name"
    )
    return json_response(200, {"categories": database.dicts_from_rows(categories)})


def handle_get_accounts(event: dict) -> dict:
    """Get all accounts."""
    accounts = database.fetchall("SELECT * FROM accounts ORDER BY id")
    return json_response(200, {"accounts": database.dicts_from_rows(accounts)})


def handle_status(event: dict) -> dict:
    """Get status for iOS app."""
    # Get last transaction date
    last_txn = database.fetchone(
        "SELECT MAX(created_at) as last_update FROM transactions"
    )

    # Get pending review count
    review_count = database.fetchone(
        "SELECT COUNT(*) as count FROM transactions WHERE needs_review = 1"
    )

    return json_response(
        200,
        {
            "last_update": last_txn["last_update"] if last_txn else None,
            "pending_review_count": review_count["count"] if review_count else 0,
        },
    )
