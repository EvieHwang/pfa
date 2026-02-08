"""CSV parsers for Bank of America transaction exports."""

import csv
import hashlib
import io
import logging
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ParsedTransaction:
    """A parsed transaction from CSV."""

    date: str  # YYYY-MM-DD format
    description: str
    amount: float  # Negative for expenses, positive for income/credits
    reference_number: str | None
    dedup_hash: str


class CSVParseError(Exception):
    """Error parsing CSV file."""

    pass


def detect_format(content: str) -> str:
    """
    Auto-detect CSV format from content.

    Returns: 'credit_card_boa' or 'checking_savings_boa'
    Raises: CSVParseError if format cannot be detected
    """
    lines = content.strip().split("\n")
    if not lines:
        raise CSVParseError("Empty CSV file")

    # Check first non-empty line for header patterns
    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Credit card format: Posted Date,Reference Number,Payee,Address,Amount
        if "Reference Number" in line and "Payee" in line:
            return "credit_card_boa"

        # Checking/savings format: Date,Description,Amount,Running Bal.
        if "Running Bal" in line:
            return "checking_savings_boa"

        # Also check for the pattern without full header
        if "Description" in line and "Amount" in line:
            return "checking_savings_boa"

    raise CSVParseError("Could not detect CSV format from header")


def parse_credit_card_boa(content: str) -> list[ParsedTransaction]:
    """
    Parse Bank of America credit card CSV.

    Format:
    Posted Date,Reference Number,Payee,Address,Amount
    01/15/2026,12345678,AMAZON PRIME,SEATTLE WA,-49.99
    """
    transactions = []
    reader = csv.DictReader(io.StringIO(content))

    required_fields = {"Posted Date", "Reference Number", "Payee", "Amount"}
    if not required_fields.issubset(set(reader.fieldnames or [])):
        raise CSVParseError(
            f"Missing required fields. Expected: {required_fields}, "
            f"Got: {reader.fieldnames}"
        )

    for row in reader:
        try:
            # Parse date (MM/DD/YYYY -> YYYY-MM-DD)
            date_str = row["Posted Date"].strip()
            date = datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%d")

            # Parse amount
            amount_str = row["Amount"].strip().replace(",", "")
            amount = float(amount_str)

            # Description is Payee + Address
            payee = row["Payee"].strip()
            address = row.get("Address", "").strip()
            description = f"{payee} {address}".strip() if address else payee

            # Reference number
            ref_num = row["Reference Number"].strip()

            # Dedup hash: date + reference number
            dedup_hash = hashlib.sha256(f"{date}:{ref_num}".encode()).hexdigest()[:32]

            transactions.append(
                ParsedTransaction(
                    date=date,
                    description=description,
                    amount=amount,
                    reference_number=ref_num,
                    dedup_hash=dedup_hash,
                )
            )
        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping invalid row: {row}, error: {e}")
            continue

    return transactions


def parse_checking_savings_boa(content: str) -> list[ParsedTransaction]:
    """
    Parse Bank of America checking/savings CSV.

    Format (with header section to skip):
    Description,,Summary Amt.
    Beginning balance as of 01/01/2026,,$10,000.00
    ...
    Ending balance as of 01/31/2026,,$12,000.00

    Date,Description,Amount,Running Bal.
    01/15/2026,DIRECT DEPOSIT ACME CORP,3500.00,15234.56
    """
    transactions = []
    lines = content.strip().split("\n")

    # Find the transaction header line
    header_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("Date,Description,Amount"):
            header_idx = i
            break

    if header_idx is None:
        raise CSVParseError("Could not find transaction header row")

    # Parse from header line onwards
    transaction_content = "\n".join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(transaction_content))

    for row in reader:
        try:
            # Skip empty rows
            date_str = row.get("Date", "").strip()
            if not date_str:
                continue

            # Parse date (MM/DD/YYYY -> YYYY-MM-DD)
            date = datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%d")

            # Parse amount (may have commas)
            amount_str = row["Amount"].strip().replace(",", "")
            if not amount_str:
                continue
            amount = float(amount_str)

            # Description
            description = row["Description"].strip()

            # Dedup hash: date + amount + first 50 chars of description
            desc_part = description[:50]
            dedup_hash = hashlib.sha256(
                f"{date}:{amount}:{desc_part}".encode()
            ).hexdigest()[:32]

            transactions.append(
                ParsedTransaction(
                    date=date,
                    description=description,
                    amount=amount,
                    reference_number=None,
                    dedup_hash=dedup_hash,
                )
            )
        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping invalid row: {row}, error: {e}")
            continue

    return transactions


def parse_csv(content: str, csv_format: str | None = None) -> list[ParsedTransaction]:
    """
    Parse CSV content into transactions.

    Args:
        content: CSV file content as string
        csv_format: 'credit_card_boa' or 'checking_savings_boa', or None to auto-detect

    Returns:
        List of ParsedTransaction objects
    """
    if csv_format is None:
        csv_format = detect_format(content)

    if csv_format == "credit_card_boa":
        return parse_credit_card_boa(content)
    elif csv_format == "checking_savings_boa":
        return parse_checking_savings_boa(content)
    else:
        raise CSVParseError(f"Unknown CSV format: {csv_format}")
