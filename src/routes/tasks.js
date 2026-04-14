const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const prisma = new PrismaClient();

const completionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Slow down — too many completions at once' }
});

// Get all active tasks with user completion status
router.get('/', requireAuth, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
      include: {
        completions: {
          where: { userId: req.user.id }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      type: t.type,
      url: t.url,
      points: t.points,
      clickedAt: t.completions[0]?.clickedAt || null,
      completedAt: t.completions[0]?.completedAt || null,
      canComplete: t.completions[0]?.clickedAt && !t.completions[0]?.completedAt
        && (Date.now() - new Date(t.completions[0].clickedAt).getTime()) >= 30000
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Record when user clicks the task link (starts 30s timer)
router.post('/:id/click', requireAuth, completionLimiter, async (req, res) => {
  const taskId = parseInt(req.params.id);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.isActive) return res.status(404).json({ error: 'Task not found' });

    const existing = await prisma.taskCompletion.findUnique({
      where: { userId_taskId: { userId: req.user.id, taskId } }
    });
    if (existing?.completedAt) return res.status(409).json({ error: 'Already completed' });
    if (existing?.clickedAt) return res.json({ message: 'Already clicked', clickedAt: existing.clickedAt });

    const record = await prisma.taskCompletion.create({
      data: { userId: req.user.id, taskId, clickedAt: new Date() }
    });
    res.json({ message: 'Click recorded — wait 30 seconds then mark as done', clickedAt: record.clickedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark task as done and award points (must have clicked ≥30s ago)
router.post('/:id/complete', requireAuth, completionLimiter, async (req, res) => {
  const taskId = parseInt(req.params.id);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.isActive) return res.status(404).json({ error: 'Task not found' });

    const record = await prisma.taskCompletion.findUnique({
      where: { userId_taskId: { userId: req.user.id, taskId } }
    });
    if (!record) return res.status(400).json({ error: 'You must click the task link first' });
    if (record.completedAt) return res.status(409).json({ error: 'Already completed' });
    if (!record.clickedAt) return res.status(400).json({ error: 'No click recorded' });

    const elapsed = Date.now() - new Date(record.clickedAt).getTime();
    if (elapsed < 30000) {
      return res.status(400).json({ error: `Wait ${Math.ceil((30000 - elapsed) / 1000)} more seconds` });
    }

    await prisma.$transaction([
      prisma.taskCompletion.update({
        where: { userId_taskId: { userId: req.user.id, taskId } },
        data: { completedAt: new Date() }
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { points: { increment: task.points } }
      })
    ]);

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { points: true } });
    res.json({ message: `+${task.points} points earned!`, points: user.points });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
