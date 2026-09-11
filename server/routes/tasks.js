const express = require('express');
const db = require('../db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(d) {
  return DATE_RE.test(d);
}

module.exports = function (io) {
  const router = express.Router();

  function broadcast(dateStr) {
    const day = db.getDay(dateStr);
    io.emit('day:update', { date: dateStr, blocks: day.blocks, stats: db.computeDayStats(dateStr) });
    io.emit('streak:update', db.getStreak());
  }

  router.get('/meta', (req, res) => {
    res.json({ today: db.todayStr(), tomorrow: db.tomorrowStr() });
  });

  router.get('/streak', (req, res) => {
    res.json(db.getStreak());
  });

  router.get('/today', (req, res) => {
    const date = db.todayStr();
    const day = db.getDay(date);
    res.json({ date, blocks: day.blocks, stats: db.computeDayStats(date), streak: db.getStreak() });
  });

  router.get('/day/:date', (req, res) => {
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    const day = db.getDay(req.params.date);
    res.json({ date: req.params.date, blocks: day.blocks, stats: db.computeDayStats(req.params.date) });
  });

  router.post('/day/:date/blocks', (req, res) => {
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    try {
      const block = db.addBlock(req.params.date, req.body || {});
      broadcast(req.params.date);
      res.status(201).json(block);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/day/:date/blocks/:id', (req, res) => {
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    try {
      const block = db.editBlock(req.params.date, req.params.id, req.body || {});
      if (!block) return res.status(404).json({ error: 'Not found' });
      broadcast(req.params.date);
      res.json(block);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete('/day/:date/blocks/:id', (req, res) => {
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    const ok = db.deleteBlock(req.params.date, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    broadcast(req.params.date);
    res.status(204).end();
  });

  router.post('/today/blocks/:id/start', (req, res) => {
    const date = db.todayStr();
    const block = db.setBlockStatus(date, req.params.id, 'in_progress', { startedAt: new Date().toISOString() });
    if (!block) return res.status(404).json({ error: 'Not found' });
    broadcast(date);
    res.json(block);
  });

  router.post('/today/blocks/:id/done', (req, res) => {
    const date = db.todayStr();
    const block = db.setBlockStatus(date, req.params.id, 'done', { doneAt: new Date().toISOString() });
    if (!block) return res.status(404).json({ error: 'Not found' });
    broadcast(date);
    res.json(block);
  });

  router.post('/today/blocks/:id/skip', (req, res) => {
    const date = db.todayStr();
    const block = db.setBlockStatus(date, req.params.id, 'skipped');
    if (!block) return res.status(404).json({ error: 'Not found' });
    broadcast(date);
    res.json(block);
  });

  return router;
};
