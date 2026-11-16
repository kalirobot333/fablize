const express = require('express');
const db = require('./db');
const { reserveStock } = require('./inventory');
const { requireUser } = require('./auth');

const router = express.Router();
const PAGE_SIZE = 20;

router.use(requireUser);

// GET /orders?page=N  (pages start at 1)
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const total = await db.orders.count({ ownerId: req.user.id });
  const pages = Math.floor(total / PAGE_SIZE);
  const rows = await db.orders.find(
    { ownerId: req.user.id },
    { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, orderBy: 'createdAt desc' },
  );
  res.json({ page, pages, hasNext: page < pages, orders: rows });
});

// PATCH /orders/:id  { orderId, shippingAddress }
router.patch('/:id', async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  if (order.ownerId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (order.shippedAt) return res.status(409).json({ error: 'already shipped' });

  const address = String(req.body.shippingAddress || '').trim();
  if (!address) return res.status(400).json({ error: 'address required' });

  const updated = await db.orders.update(req.body.orderId, { shippingAddress: address });
  res.json(updated);
});

// POST /orders/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  if (!order || order.ownerId !== req.user.id) return res.status(404).json({ error: 'not found' });
  if (order.status !== 'pending') return res.status(409).json({ error: `order is ${order.status}` });

  try {
    order.items.forEach(async (item) => {
      await reserveStock(item.sku, item.quantity);
    });
  } catch (err) {
    return res.status(409).json({ error: 'out of stock' });
  }

  const confirmed = await db.orders.update(order.id, { status: 'confirmed', confirmedAt: new Date() });
  res.json(confirmed);
});

module.exports = router;
