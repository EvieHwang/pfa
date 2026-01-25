"""Dashboard routes for PFA API."""

from datetime import date, timedelta
from ..handler import route, json_response, get_query_params
from .. import database
from ..models import Transaction


@route("/dashboard", method="GET")
def get_dashboard(event):
    """Get dashboard summary data."""
    params = get_query_params(event)

    # Parse date range
    today = date.today()
    start_date = params.get("start_date", today.replace(day=1).isoformat())
    end_date = params.get("end_date", today.isoformat())
    account_id = params.get("account_id")

    # Build account filter
    account_filter = ""
    account_params = []
    if account_id:
        account_filter = " AND t.account_id = ?"
        account_params = [account_id]

    # Get summary data

    # Net worth (sum of all account balances)
    # For now, just sum all transactions
    net_worth_row = database.fetch_one(
        f"""SELECT COALESCE(SUM(amount), 0) FROM transactions t
            WHERE 1=1 {account_filter}""",
        tuple(account_params)
    )
    net_worth = float(net_worth_row[0]) if net_worth_row else 0

    # Net worth change (this period vs prior period)
    period_days = (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days + 1
    prior_end = (date.fromisoformat(start_date) - timedelta(days=1)).isoformat()
    prior_start = (date.fromisoformat(start_date) - timedelta(days=period_days)).isoformat()

    current_change = database.fetch_one(
        f"""SELECT COALESCE(SUM(amount), 0) FROM transactions t
            WHERE date BETWEEN ? AND ? {account_filter}""",
        (start_date, end_date) + tuple(account_params)
    )[0]

    prior_change = database.fetch_one(
        f"""SELECT COALESCE(SUM(amount), 0) FROM transactions t
            WHERE date BETWEEN ? AND ? {account_filter}""",
        (prior_start, prior_end) + tuple(account_params)
    )[0]

    # Monthly spending (expenses only, negative amounts)
    monthly_spending_row = database.fetch_one(
        f"""SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions t
            WHERE date BETWEEN ? AND ? AND amount < 0 {account_filter}""",
        (start_date, end_date) + tuple(account_params)
    )
    monthly_spending = float(monthly_spending_row[0]) if monthly_spending_row else 0

    # Previous period spending
    prev_spending_row = database.fetch_one(
        f"""SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions t
            WHERE date BETWEEN ? AND ? AND amount < 0 {account_filter}""",
        (prior_start, prior_end) + tuple(account_params)
    )
    previous_month_spending = float(prev_spending_row[0]) if prev_spending_row else 0

    # Top spending category
    top_category_row = database.fetch_one(
        f"""SELECT c.name, ABS(SUM(t.amount)) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.date BETWEEN ? AND ? AND t.amount < 0 {account_filter}
            GROUP BY c.id
            ORDER BY total DESC
            LIMIT 1""",
        (start_date, end_date) + tuple(account_params)
    )
    top_category = top_category_row[0] if top_category_row else None
    top_category_amount = float(top_category_row[1]) if top_category_row else 0

    # Pending review count
    review_count = database.fetch_one(
        "SELECT COUNT(*) FROM transactions WHERE needs_review = 1"
    )[0]

    # Spending by category
    category_rows = database.fetch_all(
        f"""SELECT c.id, c.name, ABS(SUM(t.amount)) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.date BETWEEN ? AND ? AND t.amount < 0 {account_filter}
            GROUP BY c.id
            ORDER BY total DESC""",
        (start_date, end_date) + tuple(account_params)
    )

    total_spending = sum(float(row[2]) for row in category_rows)
    spending_by_category = [
        {
            "category_id": row[0],
            "category_name": row[1],
            "amount": float(row[2]),
            "percentage": round(float(row[2]) / total_spending * 100, 1) if total_spending > 0 else 0
        }
        for row in category_rows
    ]

    # Monthly trend (last 12 months)
    trend_rows = database.fetch_all(
        f"""SELECT strftime('%Y-%m', date) as month,
                   SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                   SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
            FROM transactions t
            WHERE date >= date('now', '-12 months') {account_filter}
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month""",
        tuple(account_params)
    )

    monthly_trend = [
        {
            "month": row[0],
            "income": float(row[1]),
            "expenses": float(row[2])
        }
        for row in trend_rows
    ]

    # Recent transactions
    recent_rows = database.fetch_all(
        f"""SELECT * FROM v_transaction_summary t
            WHERE 1=1 {account_filter.replace('t.account_id', 'account_id')}
            ORDER BY date DESC
            LIMIT 10""",
        tuple(account_params)
    )

    recent_transactions = [
        Transaction.from_summary_row(tuple(row)).to_dict()
        for row in recent_rows
    ]

    return json_response(200, {
        "summary": {
            "net_worth": net_worth,
            "net_worth_change": float(current_change),
            "monthly_spending": monthly_spending,
            "previous_month_spending": previous_month_spending,
            "top_category": top_category,
            "top_category_amount": top_category_amount,
            "pending_review_count": review_count
        },
        "spending_by_category": spending_by_category,
        "monthly_trend": monthly_trend,
        "recent_transactions": recent_transactions
    })


@route("/accounts", method="GET")
def list_accounts(event):
    """List all accounts."""
    rows = database.fetch_all("SELECT * FROM accounts ORDER BY name")

    accounts = [
        {
            "id": row[0],
            "name": row[1],
            "account_type": row[2]
        }
        for row in rows
    ]

    return json_response(200, {"items": accounts})
