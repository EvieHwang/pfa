"""Category routes for PFA API."""

from .. import database
from ..handler import error_response, json_response, parse_body, route
from ..models import Category


@route("/categories", method="GET")
def list_categories(event):
    """List all categories with parent names.

    Query params:
        include_inactive: if "true", include inactive categories (for Settings)
    """
    query_params = event.get("queryStringParameters") or {}
    include_inactive = query_params.get("include_inactive", "").lower() == "true"

    query = """SELECT c.id, c.name, c.category_type, c.parent_id, c.display_order,
                      c.is_active, c.created_at, p.name as parent_name
               FROM categories c
               LEFT JOIN categories p ON c.parent_id = p.id"""

    if not include_inactive:
        query += " WHERE c.is_active = 1"

    query += " ORDER BY c.display_order, c.name"

    rows = database.fetch_all(query)

    categories = [Category.from_row(tuple(row)).to_dict() for row in rows]

    return json_response(200, {"items": categories})


@route("/categories", method="POST")
def create_category(event):
    """Create a new category."""
    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    name = body.get("name")
    category_type = body.get("category_type")

    if not name or not category_type:
        return error_response(400, "Name and category_type required", "BAD_REQUEST")

    if category_type not in ("income", "expense", "transfer"):
        return error_response(400, "Invalid category_type", "BAD_REQUEST")

    parent_id = body.get("parent_id")
    display_order = body.get("display_order", 0)

    # Insert category
    cursor = database.execute_query(
        """INSERT INTO categories (name, category_type, parent_id, display_order)
           VALUES (?, ?, ?, ?)""",
        (name, category_type, parent_id, display_order)
    )
    database.commit()

    category_id = cursor.lastrowid

    # Fetch and return
    row = database.fetch_one(
        """SELECT c.id, c.name, c.category_type, c.parent_id, c.display_order,
                  c.is_active, c.created_at, p.name as parent_name
           FROM categories c
           LEFT JOIN categories p ON c.parent_id = p.id
           WHERE c.id = ?""",
        (category_id,)
    )

    category = Category.from_row(tuple(row))
    return json_response(201, category.to_dict())


@route("/categories/{id}", method="PATCH")
def update_category(event):
    """Update a category."""
    path_params = event.get("_path_params", {})
    category_id = path_params.get("id")

    if not category_id:
        return error_response(400, "Category ID required", "BAD_REQUEST")

    body = parse_body(event)
    if not body:
        return error_response(400, "Request body required", "BAD_REQUEST")

    # Check exists
    existing = database.fetch_one(
        "SELECT id FROM categories WHERE id = ?",
        (category_id,)
    )
    if not existing:
        return error_response(404, "Category not found", "NOT_FOUND")

    # Build update
    updates = []
    params = []

    if "name" in body:
        updates.append("name = ?")
        params.append(body["name"])

    if "category_type" in body:
        if body["category_type"] not in ("income", "expense", "transfer"):
            return error_response(400, "Invalid category_type", "BAD_REQUEST")
        updates.append("category_type = ?")
        params.append(body["category_type"])

    if "parent_id" in body:
        updates.append("parent_id = ?")
        params.append(body["parent_id"])

    if "display_order" in body:
        updates.append("display_order = ?")
        params.append(body["display_order"])

    # Handle is_active (deactivation/reactivation)
    is_deactivating = False
    if "is_active" in body:
        new_is_active = 1 if body["is_active"] else 0
        updates.append("is_active = ?")
        params.append(new_is_active)
        is_deactivating = new_is_active == 0

    if not updates:
        return error_response(400, "No valid fields to update", "BAD_REQUEST")

    params.append(category_id)
    query = f"UPDATE categories SET {', '.join(updates)} WHERE id = ?"
    database.execute_query(query, tuple(params))

    # If deactivating, clear category from all transactions (they go to review queue)
    if is_deactivating:
        database.execute_query(
            """UPDATE transactions
               SET category_id = NULL, needs_review = 1
               WHERE category_id = ?""",
            (category_id,)
        )

    database.commit()

    # Return updated
    row = database.fetch_one(
        """SELECT c.id, c.name, c.category_type, c.parent_id, c.display_order,
                  c.is_active, c.created_at, p.name as parent_name
           FROM categories c
           LEFT JOIN categories p ON c.parent_id = p.id
           WHERE c.id = ?""",
        (category_id,)
    )

    category = Category.from_row(tuple(row))
    return json_response(200, category.to_dict())


@route("/categories/{id}", method="DELETE")
def delete_category(event):
    """Delete a category (only if not in use)."""
    path_params = event.get("_path_params", {})
    category_id = path_params.get("id")

    if not category_id:
        return error_response(400, "Category ID required", "BAD_REQUEST")

    # Check exists
    existing = database.fetch_one(
        "SELECT id FROM categories WHERE id = ?",
        (category_id,)
    )
    if not existing:
        return error_response(404, "Category not found", "NOT_FOUND")

    # Check if in use
    in_use = database.fetch_one(
        "SELECT COUNT(*) FROM transactions WHERE category_id = ?",
        (category_id,)
    )[0]

    if in_use > 0:
        return error_response(
            400,
            f"Category is used by {in_use} transactions",
            "CATEGORY_IN_USE"
        )

    # Check if has children
    has_children = database.fetch_one(
        "SELECT COUNT(*) FROM categories WHERE parent_id = ?",
        (category_id,)
    )[0]

    if has_children > 0:
        return error_response(
            400,
            f"Category has {has_children} subcategories",
            "HAS_CHILDREN"
        )

    # Delete
    database.execute_query("DELETE FROM categories WHERE id = ?", (category_id,))
    database.commit()

    return json_response(204, None)
