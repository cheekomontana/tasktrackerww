const db = require('./db');

const TICK_MS = 15000;

function start(io, notifier) {
  function tick() {
    db.ensureRollover();

    const today = db.todayStr();
    const day = db.getDay(today);
    const now = db.nowHHMM();
    let changed = false;

    for (const block of day.blocks) {
      if (block.status === 'planned' && now >= block.start) {
        db.setBlockStatus(today, block.id, 'alerting');
        io.emit('block:alert', { date: today, block: { ...block, status: 'alerting' } });
        notifier.sendAlert(block);
        changed = true;
      } else if (block.status === 'alerting' && now >= block.end) {
        db.setBlockStatus(today, block.id, 'missed');
        notifier.sendMissed(block);
        changed = true;
      }
    }

    if (changed) {
      const refreshed = db.getDay(today);
      io.emit('day:update', { date: today, blocks: refreshed.blocks, stats: db.computeDayStats(today) });
      io.emit('streak:update', db.getStreak());
    }
  }

  tick();
  setInterval(tick, TICK_MS);
}

module.exports = { start };
