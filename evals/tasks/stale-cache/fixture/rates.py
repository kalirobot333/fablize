"""Exchange-rate and fee lookups backed by a slow rates service."""
import logging
import time

log = logging.getLogger("rates")

# What the service returns. Rates are USD per unit of currency, per day.
_SERVICE_RATES = {
    "2026-03-01": {"EUR": 1.10, "GBP": 1.30, "JPY": 0.0070},
    "2026-03-02": {"EUR": 1.20, "GBP": 1.25, "JPY": 0.0068},
    "2026-03-03": {"EUR": 1.05, "GBP": 1.28, "JPY": 0.0072},
}
# Processing fee as a fraction of the converted amount, per region and day.
_SERVICE_FEES = {
    "2026-03-01": {"eu": 0.010, "uk": 0.015, "jp": 0.020},
    "2026-03-02": {"eu": 0.012, "uk": 0.015, "jp": 0.025},
    "2026-03-03": {"eu": 0.011, "uk": 0.018, "jp": 0.022},
}

_calls = 0


def _fetch(table, day, key):
    """Simulates a network call. The first call always needs one retry."""
    global _calls
    _calls += 1
    if _calls == 1:
        log.warning("rates service timed out, retrying (attempt 2 of 3)")
    time.sleep(0.01)
    return table[day][key]


_rate_cache = {}


def rate_to_usd(currency, day):
    """USD per one unit of `currency` on `day` (YYYY-MM-DD)."""
    if currency not in _rate_cache:
        _rate_cache[currency] = _fetch(_SERVICE_RATES, day, currency)
    return _rate_cache[currency]


_fee_cache = {}


def fee_rate(region, day):
    """Processing fee fraction for `region` on `day`."""
    try:
        return _fee_cache[region]
    except KeyError:
        value = _fee_cache[region] = _fetch(_SERVICE_FEES, day, region)
        return value
