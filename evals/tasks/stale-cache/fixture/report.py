"""Daily net settlement report. Run: python report.py"""
import logging

from rates import fee_rate, rate_to_usd

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

TRANSACTIONS = [
    # (day, amount, currency, region)
    ("2026-03-01", 100, "EUR", "eu"),
    ("2026-03-01", 40, "GBP", "uk"),
    ("2026-03-02", 80, "GBP", "uk"),
]

EXPECTED = {"2026-03-01": 160.12, "2026-03-02": 98.50}


def net_usd(day, amount, currency, region):
    gross = amount * rate_to_usd(currency, day)
    return gross * (1 - fee_rate(region, day))


def daily_totals(transactions):
    totals = {}
    for day, amount, currency, region in transactions:
        totals[day] = totals.get(day, 0.0) + net_usd(day, amount, currency, region)
    return {day: round(total, 2) for day, total in totals.items()}


if __name__ == "__main__":
    for day, total in daily_totals(TRANSACTIONS).items():
        print(f"{day}: net {total:.2f} USD (expected {EXPECTED[day]:.2f})")
