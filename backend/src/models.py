"""Data models for PFA application."""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
import uuid


@dataclass
class Account:
    """Represents a bank account."""
    id: str
    name: str
    account_type: str  # "checking", "savings", "credit"
    created_at: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_row(cls, row: tuple) -> "Account":
        return cls(
            id=row[0],
            name=row[1],
            account_type=row[2],
            created_at=datetime.fromisoformat(row[3]) if row[3] else datetime.utcnow()
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "account_type": self.account_type,
        }


@dataclass
class Category:
    """Represents a spending/income category."""
    id: int
    name: str
    category_type: str  # "income", "expense", "transfer"
    parent_id: Optional[int] = None
    parent_name: Optional[str] = None
    display_order: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_row(cls, row: tuple) -> "Category":
        return cls(
            id=row[0],
            name=row[1],
            category_type=row[2],
            parent_id=row[3] if len(row) > 3 else None,
            display_order=row[4] if len(row) > 4 else 0,
            created_at=datetime.fromisoformat(row[5]) if len(row) > 5 and row[5] else datetime.utcnow(),
            parent_name=row[6] if len(row) > 6 else None
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "category_type": self.category_type,
            "parent_id": self.parent_id,
            "parent_name": self.parent_name,
            "display_order": self.display_order,
        }


@dataclass
class Transaction:
    """Represents a financial transaction."""
    id: str
    account_id: str
    date: date
    description: str
    amount: Decimal
    hash: str
    category_id: Optional[int] = None
    needs_review: bool = True
    raw_data: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    # Joined fields
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    category_name: Optional[str] = None
    category_type: Optional[str] = None
    parent_category_name: Optional[str] = None

    @staticmethod
    def generate_id() -> str:
        return str(uuid.uuid4())

    @classmethod
    def from_row(cls, row: tuple) -> "Transaction":
        return cls(
            id=row[0],
            account_id=row[1],
            date=date.fromisoformat(row[2]) if isinstance(row[2], str) else row[2],
            description=row[3],
            amount=Decimal(str(row[4])),
            category_id=row[5],
            needs_review=bool(row[6]),
            hash=row[7],
            raw_data=row[8] if len(row) > 8 else None,
            created_at=datetime.fromisoformat(row[9]) if len(row) > 9 and row[9] else datetime.utcnow()
        )

    @classmethod
    def from_summary_row(cls, row: tuple) -> "Transaction":
        """Create from v_transaction_summary view."""
        return cls(
            id=row[0],
            date=date.fromisoformat(row[1]) if isinstance(row[1], str) else row[1],
            description=row[2],
            amount=Decimal(str(row[3])),
            needs_review=bool(row[4]),
            created_at=datetime.fromisoformat(row[5]) if row[5] else datetime.utcnow(),
            account_id=row[6],
            account_name=row[7],
            account_type=row[8],
            category_id=row[9],
            category_name=row[10],
            category_type=row[11],
            parent_category_name=row[12] if len(row) > 12 else None,
            hash=""
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "description": self.description,
            "amount": float(self.amount),
            "needs_review": self.needs_review,
            "account_id": self.account_id,
            "account_name": self.account_name,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "parent_category_name": self.parent_category_name,
        }


@dataclass
class CategorizationRule:
    """Defines patterns for auto-categorizing transactions."""
    id: int
    pattern: str
    category_id: int
    priority: int = 100
    account_filter: Optional[str] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    category_name: Optional[str] = None

    @classmethod
    def from_row(cls, row: tuple) -> "CategorizationRule":
        return cls(
            id=row[0],
            pattern=row[1],
            category_id=row[2],
            priority=row[3],
            account_filter=row[4],
            is_active=bool(row[5]),
            created_at=datetime.fromisoformat(row[6]) if len(row) > 6 and row[6] else datetime.utcnow(),
            category_name=row[7] if len(row) > 7 else None
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "pattern": self.pattern,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "priority": self.priority,
            "account_filter": self.account_filter,
            "is_active": self.is_active,
        }


@dataclass
class Budget:
    """Defines monthly spending limits per category."""
    id: int
    category_id: int
    monthly_amount: Decimal
    effective_date: date
    created_at: datetime = field(default_factory=datetime.utcnow)
    category_name: Optional[str] = None
    actual_spent: Optional[Decimal] = None
    remaining: Optional[Decimal] = None
    percent_used: Optional[float] = None

    @classmethod
    def from_row(cls, row: tuple) -> "Budget":
        return cls(
            id=row[0],
            category_id=row[1],
            monthly_amount=Decimal(str(row[2])),
            effective_date=date.fromisoformat(row[3]) if isinstance(row[3], str) else row[3],
            created_at=datetime.fromisoformat(row[4]) if len(row) > 4 and row[4] else datetime.utcnow()
        )

    @classmethod
    def from_summary_row(cls, row: tuple) -> "Budget":
        """Create from v_budget_actual view."""
        return cls(
            id=row[0],
            category_id=row[1],
            category_name=row[2],
            monthly_amount=Decimal(str(row[3])),
            effective_date=date.today(),  # Not in summary view
            actual_spent=Decimal(str(row[5])) if row[5] else Decimal("0"),
            remaining=Decimal(str(row[6])) if row[6] else Decimal("0"),
            percent_used=float(row[7]) if row[7] else 0.0
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "monthly_amount": float(self.monthly_amount),
            "effective_date": self.effective_date.isoformat() if self.effective_date else None,
            "actual_spent": float(self.actual_spent) if self.actual_spent else None,
            "remaining": float(self.remaining) if self.remaining else None,
            "percent_used": self.percent_used,
        }


@dataclass
class Setting:
    """Key-value store for application configuration."""
    key: str
    value: str
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_row(cls, row: tuple) -> "Setting":
        return cls(
            key=row[0],
            value=row[1],
            updated_at=datetime.fromisoformat(row[2]) if len(row) > 2 and row[2] else datetime.utcnow()
        )
