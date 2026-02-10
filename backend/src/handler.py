"""Lambda handler for Burn Rate API."""

import base64
import json
import logging
import math
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
        # Sync database from S3 at start of each request
        database.sync_from_s3()

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
        if normalized_path == "/categories":
            if http_method == "GET":
                return handle_get_categories(event)
            if http_method == "POST":
                return handle_create_category(event)

        if normalized_path.startswith("/categories/"):
            parts = normalized_path.split("/")
            if len(parts) == 3 and parts[2].isdigit():
                cat_id = int(parts[2])
                if http_method == "PUT":
                    return handle_update_category(event, cat_id)
                if http_method == "DELETE":
                    return handle_delete_category(event, cat_id)

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

        # Transaction recurring/explosion toggle
        if normalized_path.startswith("/transactions/") and http_method == "PATCH":
            parts = normalized_path.split("/")
            if len(parts) == 4 and parts[2].isdigit():
                txn_id = int(parts[2])
                if parts[3] == "recurring":
                    return handle_toggle_recurring(event, txn_id)
                if parts[3] == "explosion":
                    return handle_toggle_explosion(event, txn_id)

        # Burn rate routes (Phase 3)
        if normalized_path == "/burn-rate" and http_method == "GET":
            return handle_get_burn_rate(event)

        if normalized_path == "/feedback" and http_method == "POST":
            return handle_submit_feedback(event)

        if normalized_path == "/targets" and http_method == "GET":
            return handle_get_targets(event)

        # Settings routes
        if normalized_path == "/settings/intensity":
            if http_method == "GET":
                return handle_get_intensity(event)
            if http_method == "PUT":
                return handle_set_intensity(event)

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
    from datetime import datetime, timedelta

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

    # Purge transactions older than 30 days
    cutoff_date = (datetime.now().date() - timedelta(days=30)).isoformat()
    purge_result = database.execute(
        "DELETE FROM transactions WHERE date < ?", (cutoff_date,)
    )
    purged_count = purge_result.rowcount if purge_result else 0

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
    categorized_count = _apply_rules_to_uncategorized()

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
            "purged_count": purged_count,
        },
    )


def _apply_rules_to_uncategorized() -> int:
    """Apply all rules to uncategorized transactions. Returns count of categorized."""
    rules = database.fetchall("SELECT * FROM rules ORDER BY priority ASC")
    if not rules:
        return 0

    categorized_count = 0
    uncategorized = database.fetchall(
        "SELECT id, description, account_id FROM transactions WHERE needs_review = 1"
    )

    for txn in uncategorized:
        for rule in rules:
            if rule["pattern"].lower() in txn["description"].lower():
                # Check account filter
                if rule["account_filter"] and rule["account_filter"] != txn["account_id"]:
                    continue
                # Apply category
                database.execute(
                    "UPDATE transactions SET category_id = ?, needs_review = 0 WHERE id = ?",
                    (rule["category_id"], txn["id"]),
                )
                categorized_count += 1
                break

    return categorized_count


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
    params = event.get("queryStringParameters") or {}
    sort_by = params.get("sort", "description")  # Default to description

    # Map sort options to SQL
    sort_map = {
        "description": "t.description ASC, t.date DESC",
        "date": "t.date DESC, t.id DESC",
        "amount": "ABS(t.amount) DESC, t.date DESC",
    }
    order_clause = sort_map.get(sort_by, sort_map["description"])

    transactions = database.fetchall(
        f"""
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.needs_review = 1
        ORDER BY {order_clause}
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

    # Optionally create a rule and apply to all matching transactions
    auto_categorized = 0
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
            # Apply the new rule to all matching uncategorized transactions
            auto_categorized = _apply_rules_to_uncategorized()

    database.commit()
    database.upload_database()

    return json_response(200, {"success": True, "auto_categorized": auto_categorized})


def handle_get_categories(event: dict) -> dict:
    """Get all categories."""
    categories = database.fetchall(
        "SELECT * FROM categories ORDER BY burn_rate_group, parent_id, name"
    )
    return json_response(200, {"categories": database.dicts_from_rows(categories)})


def handle_create_category(event: dict) -> dict:
    """Create a new category."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    name = body.get("name")
    burn_rate_group = body.get("burn_rate_group")
    parent_id = body.get("parent_id")

    if not name:
        return error_response(400, "name required")
    if burn_rate_group not in ["food", "discretionary", "recurring", "explosion", "excluded"]:
        return error_response(400, "burn_rate_group must be one of: food, discretionary, recurring, explosion, excluded")

    # Check for duplicate name
    existing = database.fetchone("SELECT id FROM categories WHERE name = ?", (name,))
    if existing:
        return error_response(409, "Category with this name already exists")

    cursor = database.execute(
        "INSERT INTO categories (name, burn_rate_group, parent_id) VALUES (?, ?, ?)",
        (name, burn_rate_group, parent_id),
    )

    database.commit()
    database.upload_database()

    return json_response(201, {"id": cursor.lastrowid, "success": True})


def handle_update_category(event: dict, category_id: int) -> dict:
    """Update a category."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    # Verify category exists
    category = database.fetchone("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not category:
        return error_response(404, "Category not found")

    name = body.get("name", category["name"])
    burn_rate_group = body.get("burn_rate_group", category["burn_rate_group"])
    parent_id = body.get("parent_id", category["parent_id"])

    if burn_rate_group not in ["food", "discretionary", "recurring", "explosion", "excluded"]:
        return error_response(400, "burn_rate_group must be one of: food, discretionary, recurring, explosion, excluded")

    # Check for duplicate name (excluding self)
    existing = database.fetchone(
        "SELECT id FROM categories WHERE name = ? AND id != ?", (name, category_id)
    )
    if existing:
        return error_response(409, "Category with this name already exists")

    database.execute(
        "UPDATE categories SET name = ?, burn_rate_group = ?, parent_id = ? WHERE id = ?",
        (name, burn_rate_group, parent_id, category_id),
    )

    database.commit()
    database.upload_database()

    return json_response(200, {"success": True})


def handle_delete_category(event: dict, category_id: int) -> dict:
    """Delete a category. Transactions using it return to review queue."""
    # Verify category exists
    category = database.fetchone("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not category:
        return error_response(404, "Category not found")

    # Check if any rules use this category - delete them too
    database.execute("DELETE FROM rules WHERE category_id = ?", (category_id,))

    # Unassign transactions and return them to review queue
    txn_result = database.execute(
        "UPDATE transactions SET category_id = NULL, needs_review = 1 WHERE category_id = ?",
        (category_id,)
    )
    returned_to_review = txn_result.rowcount if txn_result else 0

    # Check for child categories - reassign to no parent
    database.execute(
        "UPDATE categories SET parent_id = NULL WHERE parent_id = ?", (category_id,)
    )

    database.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    database.commit()
    database.upload_database()

    return json_response(200, {
        "success": True,
        "transactions_returned_to_review": returned_to_review,
    })


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

    # Auto-apply the new rule to existing uncategorized transactions
    auto_categorized = _apply_rules_to_uncategorized()

    database.commit()
    database.upload_database()

    return json_response(201, {
        "id": cursor.lastrowid,
        "success": True,
        "auto_categorized": auto_categorized,
    })


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

    # Auto-apply updated rules to existing uncategorized transactions
    auto_categorized = _apply_rules_to_uncategorized()

    database.commit()
    database.upload_database()

    return json_response(200, {"success": True, "auto_categorized": auto_categorized})


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


def handle_toggle_explosion(event: dict, transaction_id: int) -> dict:
    """Toggle is_explosion flag on a transaction (one-off large purchase)."""
    txn = database.fetchone("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
    if not txn:
        return error_response(404, "Transaction not found")

    new_value = 0 if txn["is_explosion"] else 1
    database.execute(
        "UPDATE transactions SET is_explosion = ? WHERE id = ?",
        (new_value, transaction_id),
    )

    database.commit()
    database.upload_database()

    return json_response(200, {"is_explosion": bool(new_value)})


# --- Phase 3: Burn Rate ---

# Intensity dial constants
HIGH_HALFLIFE = 20.0  # days - gentle (intensity=0)
LOW_HALFLIFE = 4.0    # days - responsive (intensity=1)
MAX_WINDOW = 45       # maximum window size for full curve
MIN_VISIBLE = 12      # minimum visible range in days
FLAT_THRESHOLD = 0.5  # $/day - slope below this is "flat"
FLAT_CONSECUTIVE = 3  # consecutive flat points needed


def calculate_half_life(intensity: float) -> float:
    """Convert intensity (0.0-1.0) to half-life in days.

    intensity=0.0 (Gentle): half_life=20 days (slow decay, long memory)
    intensity=1.0 (Responsive): half_life=4 days (fast decay, recent focus)
    """
    return HIGH_HALFLIFE - ((HIGH_HALFLIFE - LOW_HALFLIFE) * intensity)


def calculate_weight(day_offset: int, half_life: float) -> float:
    """Exponential decay weight for a transaction d days ago.

    weight(d) = exp(-lambda * d) where lambda = ln(2) / half_life
    """
    decay_constant = math.log(2) / half_life
    return math.exp(-decay_constant * day_offset)


def detect_flatness(curve: list[dict], threshold: float = FLAT_THRESHOLD, consecutive: int = FLAT_CONSECUTIVE) -> int:
    """Detect where the curve becomes flat.

    Returns the window day where flatness begins, or MAX_WINDOW if no flat region.
    Flatness = |slope| < threshold for consecutive points.
    """
    for i in range(len(curve) - consecutive):
        is_flat = True
        for j in range(consecutive):
            if i + j + 1 < len(curve):
                slope = abs(curve[i + j + 1]["daily_rate"] - curve[i + j]["daily_rate"])
                if slope >= threshold:
                    is_flat = False
                    break
        if is_flat:
            return curve[i]["window"]
    return MAX_WINDOW


def compute_visible_range(flat_boundary: int) -> list[int]:
    """Compute visible window: ~2/3 signal, ~1/3 flat zone.

    Clamp to MIN_VISIBLE-MAX_WINDOW days visible.
    """
    # Signal portion is from day 5 to flat_boundary
    signal_days = flat_boundary - 5

    # Show 2/3 signal + 1/3 flat = extend past flat_boundary by half the signal
    flat_extension = max(0, signal_days // 2)
    visible_end = min(MAX_WINDOW, flat_boundary + flat_extension)

    # Ensure minimum visible range
    if visible_end - 5 < MIN_VISIBLE:
        visible_end = min(MAX_WINDOW, 5 + MIN_VISIBLE)

    return [5, visible_end]


def handle_get_burn_rate(event: dict) -> dict:
    """Get current burn rate curves with exponential weighting.

    Query params:
        intensity: float 0.0-1.0 (optional, defaults to user setting)
    """
    from datetime import datetime, timedelta

    # Get intensity from query param or user settings
    params = event.get("queryStringParameters") or {}
    intensity_param = params.get("intensity")

    if intensity_param is not None:
        intensity = max(0.0, min(1.0, float(intensity_param)))
    else:
        # Load from user_settings
        setting = database.fetchone(
            "SELECT setting_value FROM user_settings WHERE setting_key = 'curve_intensity'"
        )
        intensity = float(setting["setting_value"]) if setting else 0.5

    half_life = calculate_half_life(intensity)
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
            result[group] = {
                "curve": [],
                "target": target,
                "arrow": "neutral",
                "visible_range": [5, 17],
                "flat_boundary": 17,
                "intensity": intensity,
            }
            continue

        # Fetch all transactions in the MAX_WINDOW-day window
        start_date = (today - timedelta(days=MAX_WINDOW)).isoformat()
        end_date = today.isoformat()

        placeholders = ",".join("?" * len(cat_ids))
        transactions = database.fetchall(
            f"""
            SELECT date, ABS(amount) as amount
            FROM transactions
            WHERE category_id IN ({placeholders})
            AND date >= ? AND date <= ?
            AND is_recurring = 0
            AND is_explosion = 0
            AND amount < 0
            """,
            (*cat_ids, start_date, end_date),
        )

        # Compute weighted burn rate for windows 5-MAX_WINDOW days
        curve = []
        for window in range(5, MAX_WINDOW + 1):
            window_start = today - timedelta(days=window)

            total_weighted = 0.0
            total_weight = 0.0

            for txn in transactions:
                txn_date = datetime.strptime(txn["date"], "%Y-%m-%d").date()
                if txn_date >= window_start:
                    days_ago = (today - txn_date).days
                    weight = calculate_weight(days_ago, half_life)
                    total_weighted += float(txn["amount"]) * weight
                    total_weight += weight

            # Weighted average normalized by window size
            if total_weight > 0:
                daily_rate = total_weighted / window
            else:
                daily_rate = 0.0

            deviation = daily_rate - target

            curve.append({
                "window": window,
                "daily_rate": round(daily_rate, 2),
                "deviation": round(deviation, 2),
            })

        # Detect flatness and compute visible range
        flat_boundary = detect_flatness(curve)
        visible_range = compute_visible_range(flat_boundary)

        # Compute arrow based on visible portion only (not flat zone)
        visible_curve = [p for p in curve if p["window"] <= flat_boundary]
        if len(visible_curve) >= 5:
            recent = [p["deviation"] for p in visible_curve[-5:]]
            slope = (recent[-1] - recent[0]) / 4
            if slope < -1:
                arrow = "improving"  # Converging toward target
            elif slope > 1:
                arrow = "worsening"  # Diverging from target
            else:
                arrow = "stable"
        else:
            arrow = "neutral"

        # Find 14-day rate
        current_14day = next((p["daily_rate"] for p in curve if p["window"] == 14), 0)

        result[group] = {
            "curve": curve,
            "target": target,
            "arrow": arrow,
            "current_14day": current_14day,
            "visible_range": visible_range,
            "flat_boundary": flat_boundary,
            "intensity": intensity,
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


# --- Settings ---


def handle_get_intensity(event: dict) -> dict:
    """Get current curve intensity setting."""
    setting = database.fetchone(
        "SELECT setting_value FROM user_settings WHERE setting_key = 'curve_intensity'"
    )
    intensity = float(setting["setting_value"]) if setting else 0.5
    return json_response(200, {"intensity": intensity})


def handle_set_intensity(event: dict) -> dict:
    """Set curve intensity setting."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required")

    intensity = body.get("intensity")
    if intensity is None:
        return error_response(400, "intensity required")

    # Validate and clamp range
    intensity = max(0.0, min(1.0, float(intensity)))

    # Upsert the setting
    database.execute(
        """
        INSERT INTO user_settings (setting_key, setting_value, updated_at)
        VALUES ('curve_intensity', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = CURRENT_TIMESTAMP
        """,
        (str(intensity),),
    )

    database.commit()
    database.upload_database()

    return json_response(200, {"intensity": intensity, "success": True})
