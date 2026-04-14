const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

const POINTS_PER_DOLLAR = parseInt(process.env.POINTS_PER_DOLLAR) || 100;
const MIN_WITHDRAW = parseInt(process.env.MIN_WITHDRAW_POINTS) || 500;

router.get('/', requireAuth, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(withdrawals);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, [
  body('points').isInt({ min: MIN_WITHDRAW }),
  body('paypalEmail').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { points, paypalEmail } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.points < points) return res.status(400).json({ error: 'Not enough points' });

    const pending = await prisma.withdrawal.findFirst({
      where: { userId: req.user.id, status: 'PENDING' }
    });
    if (pending) return res.status(409).json({ error: 'You already have a pending withdrawal' });

    const amount = points / POINTS_PER_DOLLAR;
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { points: { decrement: points } } }),
      prisma.withdrawal.create({ data: { userId: req.user.id, points, amount, paypalEmail, status: 'PENDING' } })
    ]);

    res.status(201).json({ message: `Withdrawal of $${amount.toFixed(2)} submitted. Under review.` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
