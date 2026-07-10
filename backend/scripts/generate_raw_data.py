"""
Generate synthetic Indian NBFC banking data for LoanLens Phase 1.

Usage:
  python -m scripts.generate_raw_data --load          # write CSV landing files + load DB
  python -m scripts.generate_raw_data --landing-only  # CSV landing files only
"""

from __future__ import annotations

import argparse
import csv
import random
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import psycopg2
from faker import Faker

from scripts.db_config import psycopg2_dsn

fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)

APPLICANT_COUNT = 500
MIN_TXNS_PER_APPLICANT = 300
MAX_TXNS_PER_APPLICANT = 420
HISTORY_MONTHS_MIN = 3
HISTORY_MONTHS_MAX = 6

INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad",
    "Kolkata", "Jaipur", "Lucknow", "Indore", "Kochi", "Chandigarh", "Nagpur",
]

UPI_MERCHANTS = [
    "Swiggy", "Zomato", "Amazon Pay", "Flipkart", "BigBasket", "DMart Ready",
    "PhonePe Merchant", "Google Pay Store", "IRCTC", "MakeMyTrip", "Ola", "Uber",
    "JioMart", "Reliance Digital", "Croma", "Nykaa", "Meesho", "Blinkit",
]

UTILITY_MERCHANTS = [
    "BESCOM Electricity", "MSEB Bill Pay", "Airtel Postpaid", "Jio Fiber",
    "Indane Gas", "HP Gas", "Municipal Water Board", "FASTag Recharge",
]

EMI_KEYWORDS = ["HOME LOAN EMI", "CAR LOAN EMI", "PERSONAL LOAN EMI", "EDUCATION LOAN EMI"]

REPO_ROOT = Path(__file__).resolve().parents[1]
LANDING_DIR = REPO_ROOT / "data" / "landing"
APPLICANTS_DIR = LANDING_DIR / "applicants"
TRANSACTIONS_DIR = LANDING_DIR / "transactions"


def _money(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _pan() -> str:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return (
        f"{random.choice(letters)}{random.choice(letters)}{random.choice(letters)}{random.choice(letters)}{random.choice(letters)}"
        f"{random.randint(1000, 9999)}{random.choice(letters)}"
    )


def _phone() -> str:
    return f"+91{random.randint(7000000000, 9999999999)}"


def _db_dsn() -> str:
    return psycopg2_dsn()


def generate_applicants() -> list[dict]:
    applicants: list[dict] = []
    for idx in range(APPLICANT_COUNT):
        applicant_id = uuid.uuid4()
        applicants.append(
            {
                "raw_applicant_id": str(applicant_id),
                "applicant_ref": f"APP{idx + 1:05d}",
                "name": fake.name(),
                "pan_number": _pan(),
                "phone": _phone(),
                "city": random.choice(INDIAN_CITIES),
                "monthly_income_declared": str(_money(random.uniform(25000, 250000))),
            }
        )
    return applicants


def _salary_day() -> int:
    return random.choice([1, 5])


def _emi_day(salary_day: int) -> int:
    return random.choice([d for d in (7, 10, 15, 20) if d != salary_day])


def generate_transactions(applicants: list[dict], end_date: date) -> list[dict]:
    transactions: list[dict] = []
    for applicant in applicants:
        raw_applicant_id = applicant["raw_applicant_id"]
        monthly_income = float(applicant["monthly_income_declared"])
        salary_day = _salary_day()
        emi_day = _emi_day(salary_day)
        months = random.randint(HISTORY_MONTHS_MIN, HISTORY_MONTHS_MAX)
        start_date = end_date - timedelta(days=months * 31)
        balance = _money(monthly_income * random.uniform(0.5, 2.0))
        txn_count = random.randint(MIN_TXNS_PER_APPLICANT, MAX_TXNS_PER_APPLICANT)

        month_cursor = start_date.replace(day=1)
        while month_cursor <= end_date:
            month_end = (month_cursor.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            salary_date = min(date(month_cursor.year, month_cursor.month, salary_day), month_end)
            if salary_date >= start_date:
                amount = _money(monthly_income * random.uniform(0.95, 1.05))
                balance += amount
                transactions.append(
                    _txn(raw_applicant_id, salary_date, amount, "credit", "SALARY CREDIT - NEFT", balance)
                )

            emi_date = min(date(month_cursor.year, month_cursor.month, emi_day), month_end)
            if emi_date >= start_date:
                emi_amount = _money(monthly_income * random.uniform(0.15, 0.35))
                if balance >= emi_amount:
                    balance -= emi_amount
                    transactions.append(
                        _txn(raw_applicant_id, emi_date, emi_amount, "debit", random.choice(EMI_KEYWORDS), balance)
                    )
                elif random.random() < 0.25:
                    bounce_amount = _money(emi_amount * 0.1)
                    transactions.append(
                        _txn(raw_applicant_id, emi_date, bounce_amount, "debit", "ECS RETURN CHARGES - INSUFFICIENT FUNDS", balance)
                    )

            month_cursor = (month_cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

        remaining = txn_count - len([t for t in transactions if t["raw_applicant_id"] == raw_applicant_id])
        for _ in range(max(0, remaining)):
            txn_date = start_date + timedelta(days=random.randint(0, (end_date - start_date).days))
            kind = random.choices(["upi", "utility", "cash", "transfer"], weights=[45, 20, 15, 20])[0]
            if kind == "upi":
                amount = _money(random.uniform(50, 5000))
                desc = f"UPI/{random.choice(UPI_MERCHANTS)}"
            elif kind == "utility":
                amount = _money(random.uniform(200, 8000))
                desc = random.choice(UTILITY_MERCHANTS)
            elif kind == "cash":
                amount = _money(random.uniform(500, 15000))
                desc = "ATM CASH WITHDRAWAL"
            else:
                amount = _money(random.uniform(1000, 50000))
                desc = "IMPS TRANSFER"

            if random.random() < 0.35:
                balance += amount
                transactions.append(_txn(raw_applicant_id, txn_date, amount, "credit", desc, balance))
            else:
                if balance >= amount:
                    balance -= amount
                    transactions.append(_txn(raw_applicant_id, txn_date, amount, "debit", desc, balance))

    transactions.sort(key=lambda row: (row["raw_applicant_id"], row["txn_date"]))
    return transactions


def _txn(raw_applicant_id: str, txn_date: date, amount: Decimal, txn_type: str, description: str, balance: Decimal) -> dict:
    return {
        "raw_id": str(uuid.uuid4()),
        "raw_applicant_id": raw_applicant_id,
        "txn_date": txn_date.isoformat(),
        "amount": str(amount),
        "txn_type": txn_type,
        "description": description[:255],
        "balance_after": str(balance),
        "source_format": "generated",
        "source_file_hash": "unknown",
    }


def write_landing_csv(applicants: list[dict], transactions: list[dict]) -> tuple[Path, Path]:
    APPLICANTS_DIR.mkdir(parents=True, exist_ok=True)
    TRANSACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    applicants_path = APPLICANTS_DIR / f"applicants_{stamp}.csv"
    transactions_path = TRANSACTIONS_DIR / f"transactions_{stamp}.csv"

    with applicants_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(applicants[0].keys()))
        writer.writeheader()
        writer.writerows(applicants)

    with transactions_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(transactions[0].keys()))
        writer.writeheader()
        writer.writerows(transactions)

    return applicants_path, transactions_path


def load_to_database(applicants: list[dict], transactions: list[dict]) -> tuple[int, int]:
    now = datetime.now(UTC)
    with psycopg2.connect(_db_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM raw_applicants")
            existing = cur.fetchone()[0]
            if existing >= APPLICANT_COUNT:
                print(f"Database already has {existing} applicants — skipping direct load")
                return 0, 0

            cur.executemany(
                """
                INSERT INTO raw_applicants
                (raw_applicant_id, applicant_ref, name, pan_number, phone, city, monthly_income_declared, ingested_at)
                VALUES (%(raw_applicant_id)s::uuid, %(applicant_ref)s, %(name)s, %(pan_number)s, %(phone)s,
                        %(city)s, %(monthly_income_declared)s, %(ingested_at)s)
                ON CONFLICT (applicant_ref) DO NOTHING
                """,
                [{**row, "ingested_at": now} for row in applicants],
            )

            batch_size = 5000
            inserted = 0
            for offset in range(0, len(transactions), batch_size):
                batch = [{**row, "ingested_at": now} for row in transactions[offset : offset + batch_size]]
                cur.executemany(
                    """
                    INSERT INTO raw_transactions
                    (raw_id, raw_applicant_id, txn_date, amount, txn_type, description, balance_after, source_format, source_file_hash, ingested_at)
                    VALUES (%(raw_id)s::uuid, %(raw_applicant_id)s::uuid, %(txn_date)s, %(amount)s,
                            %(txn_type)s, %(description)s, %(balance_after)s, %(source_format)s, %(source_file_hash)s, %(ingested_at)s)
                    ON CONFLICT (raw_id) DO NOTHING
                    """,
                    batch,
                )
                inserted += len(batch)
        conn.commit()
    return len(applicants), inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LoanLens raw banking data")
    parser.add_argument("--load", action="store_true", help="Load generated data directly into Postgres")
    parser.add_argument("--landing-only", action="store_true", help="Only write CSV landing files")
    args = parser.parse_args()

    end_date = date.today()
    applicants = generate_applicants()
    transactions = generate_transactions(applicants, end_date)
    applicants_path, transactions_path = write_landing_csv(applicants, transactions)

    print(f"Generated {len(applicants)} applicants and {len(transactions)} transactions")
    print(f"Landing files:\n  {applicants_path}\n  {transactions_path}")

    if args.landing_only:
        return

    if args.load or not args.landing_only:
        app_rows, txn_rows = load_to_database(applicants, transactions)
        print(f"Loaded {app_rows} applicants and {txn_rows} transactions into database")


if __name__ == "__main__":
    main()
