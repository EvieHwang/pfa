"""Transaction routes for PFA API."""

import base64
import json
import uuid

from .. import database
from ..categorization import categorize_transaction, get_active_rules
from ..csv_parser import parse_csv
from ..handler import error_response, get_query_params, json_response, parse_body, route
from ..models import Transaction


@route("/transactions", method="GET")
def list_transactions(event):
    """List transactions with optional filters."""
    params = get_query_params(event)

    # Parse parameters
    start_date = params.get("start_date")
    end_date = params.get("end_date")
    account_id = params.get("account_id")
    category_id = params.get("category_id")
    needs_review = params.get("needs_review")
    search = params.get("search")
    limit = min(int(params.get("limit", 25)), 100)
    offset = int(params.get("offset", 0))
    sort_by = params.get("sort_by", "date")
    sort_order = params.get("sort_order", "desc")

    # Build query
    query = "SELECT * FROM v_transaction_summary WHERE 1=1"
    query_params = []

    if start_date:
        query += " AND date >= ?"
        query_params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        query_params.append(end_date)

    if account_id:
        query += " AND account_id = ?"
        query_params.append(account_id)

    if category_id:
        query += " AND category_id = ?"
        query_params.append(int(category_id))

    if needs_review is not None:
        query += " AND needs_review = ?"
        query_params.append(1 if needs_review == "true" else 0)

    if search:
        query += " AND description LIKE ?"
        query_params.append(f"%{search}%")

    # Count total
    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    total = database.fetch_one(count_query, tuple(query_params))[0]

    # Add sorting and pagination
    valid_sort_cols = {"date": "date", "amount": "amount", "description": "description"}
    sort_col = valid_sort_cols.get(sort_by, "date")
    sort_dir = "DESC" if sort_order.lower() == "desc" else "ASC"
    query += f" ORDER BY {sort_col} {sort_dir} LIMIT ? OFFSET ?"
    query_params.extend([limit, offset])

    # Execute
    rows = database.fetch_all(query, tuple(query_params))
    transactions = [Transaction.from_summary_row(tuple(row)).to_dict() for row in rows]

    return json_response(200, {
        "items": transactions,
        "total": total,
        "limit": limit,
        "offset": offset
    })


@route("/transactions/upload", method="POST")
def upload_transactions(event):
    """Upload and process a CSV file."""
    # Get account_id from body or form data
    body = event.get("body", "")
    is_base64 = event.get("isBase64Encoded", False)

    # Parse multipart form data
    content_type = ""
    headers = event.get("headers", {})
    for key, value in headers.items():
        if key.lower() == "content-type":
            content_type = value
            break

    account_id = None
    file_content = None

    if "multipart/form-data" in content_type:
        # Parse multipart
        boundary = None
        for part in content_type.split(";"):
            part = part.strip()
            if part.startswith("boundary="):
                boundary = part[9:].strip('"')
                break

        if not boundary:
            return error_response(400, "Invalid multipart form data", "BAD_REQUEST")

        if is_base64:
            body = base64.b64decode(body).decode("utf-8", errors="replace")

        # Split by boundary
        parts = body.split(f"--{boundary}")

        for part in parts:
            if "Content-Disposition" not in part:
                continue

            # Parse headers and content
            if "\r\n\r\n" in part:
                header_section, content = part.split("\r\n\r\n", 1)
            elif "\n\n" in part:
                header_section, content = part.split("\n\n", 1)
            else:
                continue

            # Remove trailing boundary markers
            content = content.rstrip("\r\n-")

            # Check field name
            if 'name="account_id"' in header_section:
                account_id = content.strip()
            elif 'name="file"' in header_section:
                file_content = content

    else:
        # Try JSON body
        try:
            json_body = json.loads(body) if body else {}
            account_id = json_body.get("account_id")
            file_content = json_body.get("file_content")
            if is_base64 and file_content:
                file_content = base64.b64decode(file_content).decode("utf-8")
        except (json.JSONDecodeError, ValueError, TypeError):
            return error_response(400, "Invalid request body", "BAD_REQUEST")

    if not account_id:
        return error_response(400, "Account ID required", "BAD_REQUEST")

    if not file_content:
        return error_response(400, "CSV file required", "BAD_REQUEST")

    # Verify account exists
    account = database.fetch_one(
        "SELECT id FROM accounts WHERE id = ?",
        (account_id,)
    )
    if not account:
        return error_response(400, f"Invalid account: {account_id}", "BAD_REQUEST")

    # Parse CSV
    transactions, parse_errors = parse_csv(file_content, account_id)

    if not transactions and parse_errors:
        return error_response(400, f"CSV parsing failed: {parse_errors[0]}", "PARSE_ERROR")

    # Get categorization rules
    rules = get_active_rules()

    # Insert transactions
    new_count = 0
    duplicate_count = 0
    review_count = 0

    for tx in transactions:
        # Check for duplicate
        existing = database.fetch_one(
            "SELECT id FROM transactions WHERE hash = ?",
            (tx.hash,)
        )

        if existing:
            duplicate_count += 1
            continue

        # Categorize
        category_id = categorize_transaction(tx.description, account_id, rules)
        needs_review = 1 if category_id is None else 0

        if needs_review:
            review_count += 1

        # Insert
        tx_id = str(uuid.uuid4())
        database.execute_query(
            """INSERT INTO transactions
               (id, account_id, date, description, amount, category_id, needs_review, hash, raw_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (tx_id, account_id, tx.date, tx.description, float(tx.amount),
             category_id, needs_review, tx.hash, tx.raw_data)
        )
        new_count += 1

    database.commit()

    return json_response(200, {
        "new_count": new_count,
        "duplicate_count": duplicate_count,
        "review_count": review_count,
        "errors": parse_errors[:5] if parse_errors else []
    })


@route("/transactions/{id}", method="GET")
def get_transaction(event):
    """Get a single transaction by ID."""
    path_params = event.get("_path_params", {})
    transaction_id = path_params.get("id")

    if not transaction_id:
        return error_response(400, "Transaction ID required", "BAD_REQUEST")

    row = database.fetch_one(
        "SELECT * FROM v_transaction_summary WHERE id = ?",
        (transaction_id,)
    )

    if not row:
        return error_response(404, "Transaction not found", "NOT_FOUND")

    transaction = Transaction.from_summary_row(tuple(row))
    return json_response(200, transaction.to_dict())


@route("/transactions/{id}", method="PATCH")
def update_transaction(event):
    """Update a transaction (category, needs_review)."""
    path_params = event.get("_path_params", {})
    transaction_id = path_params.get("id")

    if not transaction_id:
        return error_response(400, "Transaction ID required", "BAD_REQUEST")

    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    # Check transaction exists
    existing = database.fetch_one(
        "SELECT id FROM transactions WHERE id = ?",
        (transaction_id,)
    )
    if not existing:
        return error_response(404, "Transaction not found", "NOT_FOUND")

    # Build update
    updates = []
    params = []

    if "category_id" in body:
        updates.append("category_id = ?")
        params.append(body["category_id"])
        # If category is set, clear needs_review
        if body["category_id"] is not None:
            updates.append("needs_review = 0")

    if "needs_review" in body:
        updates.append("needs_review = ?")
        params.append(1 if body["needs_review"] else 0)

    if not updates:
        return error_response(400, "No valid fields to update", "BAD_REQUEST")

    params.append(transaction_id)
    query = f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
    database.execute_query(query, tuple(params))
    database.commit()

    # Return updated transaction
    row = database.fetch_one(
        "SELECT * FROM v_transaction_summary WHERE id = ?",
        (transaction_id,)
    )
    transaction = Transaction.from_summary_row(tuple(row))
    return json_response(200, transaction.to_dict())


@route("/transactions/review", method="GET")
def get_review_queue(event):
    """Get transactions needing review."""
    params = get_query_params(event)
    limit = min(int(params.get("limit", 50)), 100)

    rows = database.fetch_all(
        """SELECT * FROM v_transaction_summary
           WHERE needs_review = 1
           ORDER BY date DESC
           LIMIT ?""",
        (limit,)
    )

    transactions = [Transaction.from_summary_row(tuple(row)).to_dict() for row in rows]

    # Get total count
    total = database.fetch_one(
        "SELECT COUNT(*) FROM transactions WHERE needs_review = 1"
    )[0]

    return json_response(200, {
        "items": transactions,
        "total": total
    })


@route("/transactions/review/batch", method="POST")
def batch_categorize(event):
    """Batch update transaction categories."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    updates = body.get("updates", [])
    create_rules = body.get("create_rules", [])

    if not updates:
        return error_response(400, "No updates provided", "BAD_REQUEST")

    # Apply updates
    updated_count = 0
    for update in updates:
        transaction_id = update.get("id")
        category_id = update.get("category_id")

        if not transaction_id or category_id is None:
            continue

        database.execute_query(
            """UPDATE transactions
               SET category_id = ?, needs_review = 0
               WHERE id = ?""",
            (category_id, transaction_id)
        )
        updated_count += 1

    # Create rules if requested
    rules_created = 0
    for rule in create_rules:
        pattern = rule.get("pattern")
        category_id = rule.get("category_id")

        if not pattern or category_id is None:
            continue

        database.execute_query(
            """INSERT INTO categorization_rules (pattern, category_id, priority)
               VALUES (?, ?, 50)""",
            (pattern, category_id)
        )
        rules_created += 1

    database.commit()

    return json_response(200, {
        "updated_count": updated_count,
        "rules_created": rules_created
    })


@route("/export", method="GET")
def export_transactions(event):
    """Export transactions as CSV."""
    params = get_query_params(event)

    # Parse parameters
    start_date = params.get("start_date")
    end_date = params.get("end_date")
    account_id = params.get("account_id")
    category_id = params.get("category_id")

    # Build query
    query = "SELECT * FROM v_transaction_summary WHERE 1=1"
    query_params = []

    if start_date:
        query += " AND date >= ?"
        query_params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        query_params.append(end_date)

    if account_id:
        query += " AND account_id = ?"
        query_params.append(account_id)

    if category_id:
        query += " AND category_id = ?"
        query_params.append(int(category_id))

    query += " ORDER BY date DESC"

    rows = database.fetch_all(query, tuple(query_params))

    # Build CSV
    csv_lines = ["Date,Account,Category,Description,Amount"]
    for row in rows:
        t = Transaction.from_summary_row(tuple(row))
        # Escape description for CSV
        desc = t.description.replace('"', '""')
        if ',' in desc or '"' in desc:
            desc = f'"{desc}"'
        csv_lines.append(
            f"{t.date},{t.account_name},{t.category_name or ''},{desc},{t.amount}"
        )

    csv_content = "\n".join(csv_lines)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=transactions.csv",
            "Access-Control-Allow-Origin": "*"
        },
        "body": csv_content
    }
