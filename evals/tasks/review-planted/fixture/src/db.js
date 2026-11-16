// Thin data-access layer (implementation elided for the review).
// orders.count(filter) -> number
// orders.find(filter, { offset, limit, orderBy }) -> rows
// orders.findById(id) -> row | null
// orders.update(id, fields) -> updated row (throws if id does not exist)
// stock.decrementIfAvailable(sku, quantity) -> boolean, atomic
module.exports = require('./db-impl');
