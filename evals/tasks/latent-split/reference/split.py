def split_evenly(total_cents, n):
    """Split total_cents (an int >= 0) into n parts (n >= 1).

    The parts are non-negative integers that add up to total_cents, no two
    parts differ by more than 1, and larger parts come first.

    >>> split_evenly(100, 3)
    [34, 33, 33]
    """
    base, extra = divmod(total_cents, n)
    return [base + 1] * extra + [base] * (n - extra)
