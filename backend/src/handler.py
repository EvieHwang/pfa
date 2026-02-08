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

        # Rules routes
        if normalized_path == "/rules":
            if http_method == "GET":
                return handle_get_rules(event)
            if http_method == "POST":
                return handle_create_rule(event)

        if normalized_path.startswith("/rules/"):
            parts = normalized_path.split("/")
            if len(parts) == 3 and parts[2].isdigit():
                rule_id = int(parts[2])
                if http_method == "PUT":
                    return handle_update_rule(event, rule_id)
                if http_method == "DELETE":
                    return handle_delete_rule(event, rule_id)

        # Transaction recurring toggle
        if normalized_path.startswith("/transactions/") and http_method == "PATCH":
            parts = normalized_path.split("/")
            if len(parts) == 4 and parts[2].isdigit() and parts[3] == "recurring":
                return handle_toggle_recurring(event, int(parts[2]))

        # Burn rate routes (Phase 3)
        if normalized_path == "/burn-rate" and http_method == "GET":
            return handle_get_burn_rate(event)

        if normalized_path == "/feedback" and http_method == "POST":
            return handle_submit_feedback(event)

        if normalized_path == "/targets" and http_method == "GET":
            return handle_get_targets(event)

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


# --- Phase 2: Rules Management ---


def handle_get_rules(event: dict) -> dict:
    """Get all categorization rules."""
    rules = database.fetchall(
        """
        SELECT r.*, c.name as category_name
        FROM rules r
        LEFT JOIN categories c ON r.category_id = c.id
        ORDER BY r.priority ASC
        """
    )
    return json_response(200, {"rules": database.dicts_from_rows(rules)})


def handle_create_rule(event: dict) -> dict:
    """Create a new categorization rule."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    pattern = body.get("pattern")
    category_id = body.get("category_id")
    priority = body.get("priority", 100)
    account_filter = body.get("account_filter")

    if not pattern or not category_id:
        return error_response(400, "pattern and category_id required")

    # Verify category exists
    category = database.fetchone("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not category:
        return error_response(404, "Category not found")

    cursor = database.execute(
        """
        INSERT INTO rules (pattern, category_id, priority, account_filter)
        VALUES (?, ?, ?, ?)
        """,
        (pattern, category_id, priority, account_filter),
    )

    database.commit()
    database.upload_database()

    return json_response(201, {"id": cursor.lastrowid, "success": True})


def handle_update_rule(event: dict, rule_id: int) -> dict:
    """Update a categorization rule."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    # Verify rule exists
    rule = database.fetchone("SELECT * FROM rules WHERE id = ?", (rule_id,))
    if not rule:
        return error_response(404, "Rule not found")

    # Update fields
    pattern = body.get("pattern", rule["pattern"])
    category_id = body.get("category_id", rule["category_id"])
    priority = body.get("priority", rule["priority"])
    account_filter = body.get("account_filter", rule["account_filter"])

    database.execute(
        """
        UPDATE rules SET pattern = ?, category_id = ?, priority = ?, account_filter = ?
        WHERE id = ?
        """,
        (pattern, category_id, priority, account_filter, rule_id),
    )

    database.commit()
    database.upload_database()

    return json_response(200, {"success": True})


def handle_delete_rule(event: dict, rule_id: int) -> dict:
    """Delete a categorization rule."""
    # Verify rule exists
    rule = database.fetchone("SELECT * FROM rules WHERE id = ?", (rule_id,))
    if not rule:
        return error_response(404, "Rule not found")

    database.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
    database.commit()
    database.upload_database()

    return json_response(200, {"success": True})


def handle_toggle_recurring(event: dict, transaction_id: int) -> dict:
    """Toggle is_recurring flag on a transaction."""
    txn = database.fetchone("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
    if not txn:
        return error_response(404, "Transaction not found")

    new_value = 0 if txn["is_recurring"] else 1
    database.execute(
        "UPDATE transactions SET is_recurring = ? WHERE id = ?",
        (new_value, transaction_id),
    )

    database.commit()
    database.upload_database()

    return json_response(200, {"is_recurring": bool(new_value)})


# --- Phase 3: Burn Rate ---


def handle_get_burn_rate(event: dict) -> dict:
    """Get current burn rate curves for both groups."""
    from datetime import datetime, timedelta

    today = datetime.now().date()
    result = {}

    for group in ["food", "discretionary"]:
        # Get target
        target_row = database.fetchone(
            "SELECT daily_target FROM targets WHERE burn_rate_group = ?", (group,)
        )
        target = float(target_row["daily_target"]) if target_row else 0

        # Get category IDs for this group
        categories = database.fetchall(
            "SELECT id FROM categories WHERE burn_rate_group = ?", (group,)
        )
        cat_ids = [c["id"] for c in categories]

        if not cat_ids:
            result[group] = {"curve": [], "target": target, "arrow": "neutral"}
            continue

        # Compute burn rate for windows 5-30 days
        curve = []
        for window in range(5, 31):
            start_date = (today - timedelta(days=window)).isoformat()
            end_date = today.isoformat()

            # Sum expenses in this window (negative amounts = expenses)
            placeholders = ",".join("?" * len(cat_ids))
            row = database.fetchone(
                f"""
                SELECT COALESCE(SUM(ABS(amount)), 0) as total
                FROM transactions
                WHERE category_id IN ({placeholders})
                AND date >= ? AND date <= ?
                AND is_recurring = 0
                AND is_explosion = 0
                AND amount < 0
                """,
                (*cat_ids, start_date, end_date),
            )

            total = float(row["total"]) if row else 0
            daily_rate = total / window
            deviation = daily_rate - target

            curve.append({
                "window": window,
                "daily_rate": round(daily_rate, 2),
                "deviation": round(deviation, 2),
            })

        # Compute arrow (slope of last 5 points)
        if len(curve) >= 5:
            recent = [p["deviation"] for p in curve[-5:]]
            slope = (recent[-1] - recent[0]) / 4
            if slope < -1:
                arrow = "improving"  # Converging toward target
            elif slope > 1:
                arrow = "worsening"  # Diverging from target
            else:
                arrow = "stable"
        else:
            arrow = "neutral"

        result[group] = {
            "curve": curve,
            "target": target,
            "arrow": arrow,
            "current_14day": curve[9]["daily_rate"] if len(curve) > 9 else 0,  # 14-day is index 9
        }

    return json_response(200, result)


def handle_submit_feedback(event: dict) -> dict:
    """Submit sentiment feedback and adjust target if 'good'."""
    from datetime import datetime

    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    group = body.get("burn_rate_group")
    sentiment = body.get("sentiment")

    if group not in ["food", "discretionary"]:
        return error_response(400, "burn_rate_group must be 'food' or 'discretionary'")
    if sentiment not in ["good", "bad"]:
        return error_response(400, "sentiment must be 'good' or 'bad'")

    # Get current 14-day burn rate
    burn_rate_data = handle_get_burn_rate(event)
    burn_data = json.loads(burn_rate_data["body"])
    current_14day = burn_data[group]["current_14day"]

    # Store feedback
    today = datetime.now().date().isoformat()
    database.execute(
        """
        INSERT INTO feedback (burn_rate_group, feedback_date, period_end_date, sentiment, burn_rate_at_feedback)
        VALUES (?, ?, ?, ?, ?)
        """,
        (group, today, today, sentiment, current_14day),
    )

    # If "good", adjust target
    new_target = None
    if sentiment == "good":
        target_row = database.fetchone(
            "SELECT daily_target FROM targets WHERE burn_rate_group = ?", (group,)
        )
        old_target = float(target_row["daily_target"]) if target_row else 0

        # new_target = (0.8 * old) + (0.2 * current)
        new_target = round((0.8 * old_target) + (0.2 * current_14day), 2)

        database.execute(
            "UPDATE targets SET daily_target = ?, updated_at = CURRENT_TIMESTAMP WHERE burn_rate_group = ?",
            (new_target, group),
        )

    database.commit()
    database.upload_database()

    return json_response(200, {
        "success": True,
        "new_target": new_target,
        "burn_rate_at_feedback": current_14day,
    })


def handle_get_targets(event: dict) -> dict:
    """Get current targets for all groups."""
    targets = database.fetchall("SELECT * FROM targets")
    return json_response(200, {"targets": database.dicts_from_rows(targets)})
