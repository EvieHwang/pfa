"""CSV parser for Bank of America transaction exports."""

import csv
import hashlib
import io
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass
class ParsedTransaction:
    """Represents a parsed transaction from CSV."""
    date: str  # YYYY-MM-DD format
    description: str
    amount: Decimal
    hash: str
    raw_data: str
    reference_number: str | None = None


class CSVFormat:
    """Constants for CSV format types."""
    CREDIT_CARD = "credit_card"  # Format A
    CHECKING = "checking"  # Format B


def detect_format(header_row: str) -> str:
    """Detect CSV format from header row.

    Format A (Credit Card): Posted Date,Reference Number,Payee,Address,Amount
    Format B (Checking/Savings): Date,Description,Amount,Running Bal.

    Args:
        header_row: First row of CSV file

    Returns:
        CSVFormat constant
    """
    header_lower = header_row.lower()

    if 'reference number' in header_lower or 'posted date' in header_lower:
        return CSVFormat.CREDIT_CARD
    elif 'running bal' in header_lower or ('date' in header_lower and 'description' in header_lower):
        return CSVFormat.CHECKING
    else:
        # Default to checking format
        return CSVFormat.CHECKING


def parse_amount(amount_str: str) -> Decimal | None:
    """Parse amount string, handling commas and quotes.

    Args:
        amount_str: Amount string like "1,234.56" or "-$45.00"

    Returns:
        Decimal amount or None if empty/invalid
    """
    if not amount_str or not amount_str.strip():
        return None

    # Remove quotes, dollar signs, and whitespace
    cleaned = amount_str.strip().strip('"').strip("'").replace('$', '').replace(',', '').strip()

    if not cleaned:
        return None

    try:
        return Decimal(cleaned)
    except Exception:
        return None


def parse_date(date_str: str) -> str:
    """Parse date string to YYYY-MM-DD format.

    Handles MM/DD/YYYY format from Bank of America.

    Args:
        date_str: Date string like "01/15/2026"

    Returns:
        Date in YYYY-MM-DD format
    """
    date_str = date_str.strip().strip('"')

    # Try MM/DD/YYYY format
    try:
        dt = datetime.strptime(date_str, '%m/%d/%Y')
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        pass

    # Try YYYY-MM-DD format (already correct)
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        pass

    # Return as-is if can't parse
    return date_str


def generate_hash_credit_card(date: str, reference_number: str) -> str:
    """Generate hash for credit card transaction.

    Uses date + reference number for uniqueness.
    """
    data = f"{date}|{reference_number}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


def generate_hash_checking(date: str, amount: str, description: str) -> str:
    """Generate hash for checking/savings transaction.

    Uses date + amount + first 50 chars of description.
    """
    desc_truncated = description[:50] if description else ""
    data = f"{date}|{amount}|{desc_truncated}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


def parse_credit_card_csv(content: str) -> tuple[list[ParsedTransaction], list[str]]:
    """Parse Format A (Credit Card) CSV.

    Columns: Posted Date, Reference Number, Payee, Address, Amount

    Args:
        content: CSV file content

    Returns:
        Tuple of (transactions, errors)
    """
    transactions = []
    errors = []

    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    if len(rows) < 2:
        return [], ["File has no data rows"]

    # Skip header
    for i, row in enumerate(rows[1:], start=2):
        try:
            if len(row) < 5:
                continue

            posted_date, reference_number, payee, address, amount_str = row[:5]

            # Skip if no date (might be footer row)
            if not posted_date or not posted_date.strip():
                continue

            # Parse fields
            date = parse_date(posted_date)
            amount = parse_amount(amount_str)

            if amount is None:
                continue

            description = payee.strip().strip('"')

            # Generate hash
            tx_hash = generate_hash_credit_card(date, reference_number.strip())

            # Store raw data
            raw_data = ','.join(row)

            transactions.append(ParsedTransaction(
                date=date,
                description=description,
                amount=amount,
                hash=tx_hash,
                raw_data=raw_data,
                reference_number=reference_number.strip()
            ))

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")

    return transactions, errors


def parse_checking_csv(content: str) -> tuple[list[ParsedTransaction], list[str]]:
    """Parse Format B (Checking/Savings) CSV.

    Has header section to skip, then: Date, Description, Amount, Running Bal.

    Args:
        content: CSV file content

    Returns:
        Tuple of (transactions, errors)
    """
    transactions = []
    errors = []

    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    # Find the actual transaction header row
    data_start_idx = 0
    for i, row in enumerate(rows):
        if len(row) >= 3:
            first_col = row[0].lower().strip()
            if first_col == 'date':
                data_start_idx = i + 1
                break
            # Also check for actual date pattern
            if re.match(r'\d{2}/\d{2}/\d{4}', row[0].strip()):
                data_start_idx = i
                break

    if data_start_idx == 0:
        # Try to find first row that looks like a transaction
        for i, row in enumerate(rows):
            if len(row) >= 3 and re.match(r'\d{2}/\d{2}/\d{4}', row[0].strip()):
                data_start_idx = i
                break

    for i, row in enumerate(rows[data_start_idx:], start=data_start_idx + 1):
        try:
            if len(row) < 3:
                continue

            date_str = row[0].strip()

            # Skip non-date rows
            if not re.match(r'\d{2}/\d{2}/\d{4}', date_str):
                continue

            description = row[1].strip().strip('"')
            amount_str = row[2].strip()

            # Skip if no amount
            if not amount_str:
                continue

            # Parse fields
            date = parse_date(date_str)
            amount = parse_amount(amount_str)

            if amount is None:
                continue

            # Generate hash
            tx_hash = generate_hash_checking(date, str(amount), description)

            # Store raw data
            raw_data = ','.join(row)

            transactions.append(ParsedTransaction(
                date=date,
                description=description,
                amount=amount,
                hash=tx_hash,
                raw_data=raw_data
            ))

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")

    return transactions, errors


def parse_csv(content: str, account_type: str = None) -> tuple[list[ParsedTransaction], list[str]]:
    """Parse CSV file content.

    Auto-detects format based on header row.

    Args:
        content: CSV file content
        account_type: Optional hint ("credit", "checking", "savings")

    Returns:
        Tuple of (transactions, errors)
    """
    if not content or not content.strip():
        return [], ["Empty file"]

    # Get first line for format detection
    first_line = content.split('\n')[0]

    # Detect format
    if account_type == 'credit':
        csv_format = CSVFormat.CREDIT_CARD
    else:
        csv_format = detect_format(first_line)

    # Parse based on format
    if csv_format == CSVFormat.CREDIT_CARD:
        return parse_credit_card_csv(content)
    else:
        return parse_checking_csv(content)
