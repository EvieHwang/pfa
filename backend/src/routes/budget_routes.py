"""Budget routes for PFA API."""

from .. import database
from ..handler import error_response, get_query_params, json_response, parse_body, route
from ..models import Budget


@route("/budgets", method="GET")
def list_budgets(event):
    """List budgets with actual spending data."""
    params = get_query_params(event)
    month = params.get("month")  # Format: YYYY-MM

    query = """
        SELECT b.id, b.category_id, c.name as category_name, b.monthly_amount,
               strftime('%Y-%m', b.effective_date) as budget_month,
               COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as actual_spent,
               b.monthly_amount - COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as remaining,
               CASE
                   WHEN b.monthly_amount > 0
                   THEN ROUND(COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) / b.monthly_amount * 100, 1)
                   ELSE 0
               END as percent_used
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        LEFT JOIN transactions t ON t.category_id = b.category_id
            AND strftime('%Y-%m', t.date) = strftime('%Y-%m', b.effective_date)
    """

    query_params = []

    if month:
        query += " WHERE strftime('%Y-%m', b.effective_date) = ?"
        query_params.append(month)

    query += " GROUP BY b.id ORDER BY c.display_order, c.name"

    rows = database.fetch_all(query, tuple(query_params))

    budgets = []
    for row in rows:
        budgets.append({
            "id": row[0],
            "category_id": row[1],
            "category_name": row[2],
            "budget_amount": float(row[3]),
            "budget_month": row[4],
            "actual_spent": float(row[5]),
            "remaining": float(row[6]),
            "percent_used": float(row[7])
        })

    return json_response(200, {"items": budgets})


@route("/budgets", method="POST")
def upsert_budget(event):
    """Create or update a budget."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    category_id = body.get("category_id")
    monthly_amount = body.get("monthly_amount")
    effective_date = body.get("effective_date")  # Should be YYYY-MM-01

    if category_id is None or monthly_amount is None or not effective_date:
        return error_response(
            400,
            "category_id, monthly_amount, and effective_date required",
            "BAD_REQUEST"
        )

    if monthly_amount < 0:
        return error_response(400, "monthly_amount must be non-negative", "BAD_REQUEST")

    # Verify category exists
    category = database.fetch_one(
        "SELECT id FROM categories WHERE id = ?",
        (category_id,)
    )
    if not category:
        return error_response(400, "Category not found", "BAD_REQUEST")

    # Try to update existing, otherwise insert
    existing = database.fetch_one(
        """SELECT id FROM budgets
           WHERE category_id = ? AND strftime('%Y-%m', effective_date) = strftime('%Y-%m', ?)""",
        (category_id, effective_date)
    )

    if existing:
        database.execute_query(
            """UPDATE budgets
               SET monthly_amount = ?
               WHERE id = ?""",
            (monthly_amount, existing[0])
        )
        budget_id = existing[0]
    else:
        cursor = database.execute_query(
            """INSERT INTO budgets (category_id, monthly_amount, effective_date)
               VALUES (?, ?, ?)""",
            (category_id, monthly_amount, effective_date)
        )
        budget_id = cursor.lastrowid

    database.commit()

    # Fetch and return
    row = database.fetch_one(
        """SELECT b.id, b.category_id, b.monthly_amount, b.effective_date, b.created_at
           FROM budgets b
           WHERE b.id = ?""",
        (budget_id,)
    )

    budget = Budget.from_row(tuple(row))
    return json_response(200, budget.to_dict())


@route("/budgets/{id}", method="DELETE")
def delete_budget(event):
    """Delete a budget."""
    path_params = event.get("_path_params", {})
    budget_id = path_params.get("id")

    if not budget_id:
        return error_response(400, "Budget ID required", "BAD_REQUEST")

    # Check exists
    existing = database.fetch_one(
        "SELECT id FROM budgets WHERE id = ?",
        (budget_id,)
    )
    if not existing:
        return error_response(404, "Budget not found", "NOT_FOUND")

    # Delete
    database.execute_query("DELETE FROM budgets WHERE id = ?", (budget_id,))
    database.commit()

    return json_response(204, None)
