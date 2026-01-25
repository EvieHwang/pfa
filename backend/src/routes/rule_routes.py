"""Categorization rule routes for PFA API."""

from ..handler import route, json_response, error_response, parse_body
from .. import database
from ..models import CategorizationRule


@route("/rules", method="GET")
def list_rules(event):
    """List all categorization rules."""
    rows = database.fetch_all(
        """SELECT r.id, r.pattern, r.category_id, r.priority, r.account_filter,
                  r.is_active, r.created_at, c.name as category_name
           FROM categorization_rules r
           JOIN categories c ON r.category_id = c.id
           ORDER BY r.priority, r.id"""
    )

    rules = [CategorizationRule.from_row(tuple(row)).to_dict() for row in rows]

    return json_response(200, {"items": rules})


@route("/rules", method="POST")
def create_rule(event):
    """Create a new categorization rule."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    pattern = body.get("pattern")
    category_id = body.get("category_id")

    if not pattern or category_id is None:
        return error_response(400, "Pattern and category_id required", "BAD_REQUEST")

    # Verify category exists
    category = database.fetch_one(
        "SELECT id FROM categories WHERE id = ?",
        (category_id,)
    )
    if not category:
        return error_response(400, "Category not found", "BAD_REQUEST")

    priority = body.get("priority", 100)
    account_filter = body.get("account_filter")
    is_active = body.get("is_active", True)

    # Insert rule
    cursor = database.execute_query(
        """INSERT INTO categorization_rules
           (pattern, category_id, priority, account_filter, is_active)
           VALUES (?, ?, ?, ?, ?)""",
        (pattern, category_id, priority, account_filter, 1 if is_active else 0)
    )
    database.commit()

    rule_id = cursor.lastrowid

    # Fetch and return
    row = database.fetch_one(
        """SELECT r.id, r.pattern, r.category_id, r.priority, r.account_filter,
                  r.is_active, r.created_at, c.name as category_name
           FROM categorization_rules r
           JOIN categories c ON r.category_id = c.id
           WHERE r.id = ?""",
        (rule_id,)
    )

    rule = CategorizationRule.from_row(tuple(row))
    return json_response(201, rule.to_dict())


@route("/rules/{id}", method="PATCH")
def update_rule(event):
    """Update a categorization rule."""
    path_params = event.get("_path_params", {})
    rule_id = path_params.get("id")

    if not rule_id:
        return error_response(400, "Rule ID required", "BAD_REQUEST")

    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    # Check exists
    existing = database.fetch_one(
        "SELECT id FROM categorization_rules WHERE id = ?",
        (rule_id,)
    )
    if not existing:
        return error_response(404, "Rule not found", "NOT_FOUND")

    # Build update
    updates = []
    params = []

    if "pattern" in body:
        updates.append("pattern = ?")
        params.append(body["pattern"])

    if "category_id" in body:
        # Verify category exists
        category = database.fetch_one(
            "SELECT id FROM categories WHERE id = ?",
            (body["category_id"],)
        )
        if not category:
            return error_response(400, "Category not found", "BAD_REQUEST")
        updates.append("category_id = ?")
        params.append(body["category_id"])

    if "priority" in body:
        updates.append("priority = ?")
        params.append(body["priority"])

    if "account_filter" in body:
        updates.append("account_filter = ?")
        params.append(body["account_filter"])

    if "is_active" in body:
        updates.append("is_active = ?")
        params.append(1 if body["is_active"] else 0)

    if not updates:
        return error_response(400, "No valid fields to update", "BAD_REQUEST")

    params.append(rule_id)
    query = f"UPDATE categorization_rules SET {', '.join(updates)} WHERE id = ?"
    database.execute_query(query, tuple(params))
    database.commit()

    # Return updated
    row = database.fetch_one(
        """SELECT r.id, r.pattern, r.category_id, r.priority, r.account_filter,
                  r.is_active, r.created_at, c.name as category_name
           FROM categorization_rules r
           JOIN categories c ON r.category_id = c.id
           WHERE r.id = ?""",
        (rule_id,)
    )

    rule = CategorizationRule.from_row(tuple(row))
    return json_response(200, rule.to_dict())


@route("/rules/{id}", method="DELETE")
def delete_rule(event):
    """Delete a categorization rule."""
    path_params = event.get("_path_params", {})
    rule_id = path_params.get("id")

    if not rule_id:
        return error_response(400, "Rule ID required", "BAD_REQUEST")

    # Check exists
    existing = database.fetch_one(
        "SELECT id FROM categorization_rules WHERE id = ?",
        (rule_id,)
    )
    if not existing:
        return error_response(404, "Rule not found", "NOT_FOUND")

    # Delete
    database.execute_query(
        "DELETE FROM categorization_rules WHERE id = ?",
        (rule_id,)
    )
    database.commit()

    return json_response(204, None)
