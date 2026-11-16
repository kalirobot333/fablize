# Review

1. **src/orders.js:36 — PATCH updates the wrong order (IDOR).** Ownership is checked for `req.params.id`, but the update writes to `req.body.orderId`. Any signed-in user can change the shipping address of another user's order by sending their own order id in the URL and the victim's id in the body.
2. **src/orders.js:47-49 — `forEach(async ...)` is not awaited.** The reservations run unawaited, so an `OutOfStockError` never reaches the `try/catch`; it becomes an unhandled rejection, and the order is marked confirmed before or despite stock reservation. Use `for (const item of order.items) await reserveStock(...)` or `Promise.all`.
3. **src/orders.js:15 — pagination drops the last partial page.** `Math.floor(total / PAGE_SIZE)` gives 2 pages for 45 orders, so `hasNext` is false on page 2 and the last 5 orders are unreachable. Use `Math.ceil`.
