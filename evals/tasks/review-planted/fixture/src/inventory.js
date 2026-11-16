const db = require('./db');

class OutOfStockError extends Error {}

// Atomically decrements stock; throws OutOfStockError if there is not enough.
async function reserveStock(sku, quantity) {
  const ok = await db.stock.decrementIfAvailable(sku, quantity);
  if (!ok) throw new OutOfStockError(`${sku}: not enough stock for ${quantity}`);
}

module.exports = { reserveStock, OutOfStockError };
