"""Categorization engine for automatic transaction categorization."""


from . import database


def get_active_rules() -> list[tuple]:
    """Get all active categorization rules ordered by priority.

    Returns:
        List of tuples: (id, pattern, category_id, priority, account_filter)
    """
    rows = database.fetch_all(
        """SELECT id, pattern, category_id, priority, account_filter
           FROM categorization_rules
           WHERE is_active = 1
           ORDER BY priority, id"""
    )
    return [tuple(row) for row in rows]


def categorize_transaction(
    description: str,
    account_id: str = None,
    rules: list[tuple] = None
) -> int | None:
    """Categorize a transaction based on description.

    Applies rules in priority order. First match wins.

    Args:
        description: Transaction description/payee
        account_id: Optional account ID for account-specific rules
        rules: Optional pre-fetched rules (for batch processing)

    Returns:
        Category ID if matched, None otherwise
    """
    if rules is None:
        rules = get_active_rules()

    if not description:
        return None

    # Normalize description for matching
    description_upper = description.upper()

    for _rule_id, pattern, category_id, _priority, account_filter in rules:
        # Check account filter
        if account_filter and account_id and account_filter != account_id:
            continue

        # Case-insensitive substring match
        if pattern.upper() in description_upper:
            return category_id

    return None


def categorize_transactions_batch(
    transactions: list[dict],
    account_id: str = None
) -> list[dict]:
    """Categorize multiple transactions.

    Args:
        transactions: List of dicts with 'description' key
        account_id: Optional account ID for all transactions

    Returns:
        List of dicts with 'category_id' added
    """
    # Fetch rules once
    rules = get_active_rules()

    result = []
    for tx in transactions:
        tx_copy = tx.copy()
        category_id = categorize_transaction(
            tx.get('description', ''),
            account_id or tx.get('account_id'),
            rules
        )
        tx_copy['category_id'] = category_id
        tx_copy['needs_review'] = category_id is None
        result.append(tx_copy)

    return result


def apply_categorization_to_uncategorized() -> int:
    """Apply categorization rules to all uncategorized transactions.

    Returns:
        Number of transactions categorized
    """
    rules = get_active_rules()
    if not rules:
        return 0

    # Get uncategorized transactions
    uncategorized = database.fetch_all(
        """SELECT id, description, account_id
           FROM transactions
           WHERE category_id IS NULL"""
    )

    categorized_count = 0
    for row in uncategorized:
        tx_id, description, account_id = row[0], row[1], row[2]

        category_id = categorize_transaction(description, account_id, rules)

        if category_id:
            database.execute_query(
                """UPDATE transactions
                   SET category_id = ?, needs_review = 0
                   WHERE id = ?""",
                (category_id, tx_id)
            )
            categorized_count += 1

    if categorized_count > 0:
        database.commit()

    return categorized_count


def create_rule_from_transaction(
    transaction_id: str,
    pattern: str,
    category_id: int,
    priority: int = 50
) -> int:
    """Create a new categorization rule based on a transaction.

    Args:
        transaction_id: Transaction ID (for reference, not used in rule)
        pattern: Pattern to match
        category_id: Category to assign
        priority: Rule priority (lower = higher priority)

    Returns:
        New rule ID
    """
    cursor = database.execute_query(
        """INSERT INTO categorization_rules (pattern, category_id, priority)
           VALUES (?, ?, ?)""",
        (pattern, category_id, priority)
    )
    database.commit()
    return cursor.lastrowid


def suggest_pattern_from_description(description: str) -> str:
    """Suggest a categorization pattern from a transaction description.

    Extracts the most meaningful part of the description for pattern matching.

    Args:
        description: Full transaction description

    Returns:
        Suggested pattern string
    """
    if not description:
        return ""

    # Common words to exclude
    exclude_words = {
        'THE', 'AND', 'OR', 'OF', 'IN', 'AT', 'TO', 'FOR',
        'LLC', 'INC', 'CORP', 'LTD', 'DES', 'ID', 'CO',
        'PURCHASE', 'PAYMENT', 'DEBIT', 'CREDIT', 'CARD'
    }

    # Split and clean
    words = description.upper().split()

    # Filter out common words and short words
    meaningful_words = [
        w for w in words
        if w not in exclude_words and len(w) > 2 and not w.isdigit()
    ]

    if not meaningful_words:
        # Fall back to first word
        return words[0] if words else description[:20]

    # Return first meaningful word or first two if very short
    if len(meaningful_words[0]) < 5 and len(meaningful_words) > 1:
        return ' '.join(meaningful_words[:2])

    return meaningful_words[0]
