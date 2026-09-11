const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const STATUSES = ['planned', 'alerting', 'in_progress', 'paused', 'done', 'skipped', 'missed'];

function defaultStore() {
  return {
    ownerChatId: null,
    lastRolloverDate: todayStr(),
    days: {},
    streak: { current: 0, longest: 0 },
    history: {},
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const fresh = defaultStore();
    save(fresh);
    return fresh;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultStore(), ...parsed };
  } catch (err) {
    console.error('Could not read data/store.json, starting fresh:', err.message);
    const fresh = defaultStore();
    save(fresh);
    return fresh;
  }
}

function save(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateStrOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  return dateStrOffset(0);
}

function tomorrowStr() {
  return dateStrOffset(1);
}

function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeTime(t) {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => a.start.localeCompare(b.start));
}

function getDay(dateStr) {
  const store = load();
  if (!store.days[dateStr]) {
    store.days[dateStr] = { blocks: [] };
    save(store);
  }
  return { date: dateStr, blocks: sortBlocks(store.days[dateStr].blocks) };
}

function addHour(hhmm) {
  let [h, m] = hhmm.split(':').map(Number);
  h = (h + 1) % 24;
  return `${pad(h)}:${pad(m)}`;
}

function autoTimeForDay(dateStr, blocks) {
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    return { start: last.end, end: addHour(last.end) };
  }
  if (dateStr === todayStr()) {
    const now = nowHHMM();
    return { start: now, end: addHour(now) };
  }
  return { start: '09:00', end: '10:00' };
}

function addBlock(dateStr, { start, end, title }) {
  const store = load();
  if (!store.days[dateStr]) store.days[dateStr] = { blocks: [] };
  if (!title || !title.trim()) throw new Error('Title required');

  let ns = start ? normalizeTime(start) : null;
  let ne = end ? normalizeTime(end) : null;
  if (start && !ns) throw new Error('Invalid start time');
  if (end && !ne) throw new Error('Invalid end time');

  if (!ns || !ne) {
    const auto = autoTimeForDay(dateStr, sortBlocks(store.days[dateStr].blocks));
    ns = ns || auto.start;
    ne = ne || auto.end;
  }
  if (ne <= ns) throw new Error('End time must be after start time');

  const block = {
    id: crypto.randomUUID(),
    start: ns,
    end: ne,
    title: title.trim(),
    status: 'planned',
    startedAt: null,
    doneAt: null,
    pausedAt: null,
  };
  store.days[dateStr].blocks.push(block);
  save(store);
  return block;
}

function shiftTime(hhmm, minutes) {
  let [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + minutes;
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;
  if (total < 0) total = 0;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function pauseBlock(dateStr, id) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return null;
  const block = day.blocks.find((b) => b.id === id);
  if (!block || block.status !== 'in_progress') return null;
  block.status = 'paused';
  block.pausedAt = new Date().toISOString();
  save(store);
  return block;
}

function resumeBlock(dateStr, id) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return null;
  const block = day.blocks.find((b) => b.id === id);
  if (!block || block.status !== 'paused') return null;

  const pausedAtMs = block.pausedAt ? new Date(block.pausedAt).getTime() : Date.now();
  const pauseMin = Math.max(0, Math.round((Date.now() - pausedAtMs) / 60000));

  if (pauseMin > 0) {
    const sorted = sortBlocks(day.blocks);
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx !== -1) {
      sorted[idx].end = shiftTime(sorted[idx].end, pauseMin);
      for (let i = idx + 1; i < sorted.length; i++) {
        if (sorted[i].status !== 'planned') continue;
        sorted[i].start = shiftTime(sorted[i].start, pauseMin);
        sorted[i].end = shiftTime(sorted[i].end, pauseMin);
      }
    }
  }

  block.status = 'in_progress';
  block.pausedAt = null;
  save(store);
  return { block, pauseMin };
}

function editBlock(dateStr, id, patch) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return null;
  const block = day.blocks.find((b) => b.id === id);
  if (!block) return null;
  if (patch.start !== undefined) {
    const ns = normalizeTime(patch.start);
    if (!ns) throw new Error('Invalid start time');
    block.start = ns;
  }
  if (patch.end !== undefined) {
    const ne = normalizeTime(patch.end);
    if (!ne) throw new Error('Invalid end time');
    block.end = ne;
  }
  if (patch.title !== undefined) block.title = String(patch.title).trim();
  if (block.end <= block.start) throw new Error('End time must be after start time');
  save(store);
  return block;
}

function deleteBlock(dateStr, id) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return false;
  const block = day.blocks.find((b) => b.id === id);
  if (!block) return false;
  if (block.status === 'done') throw new Error("Completed tasks can't be deleted");
  const before = day.blocks.length;
  day.blocks = day.blocks.filter((b) => b.id !== id);
  save(store);
  return day.blocks.length < before;
}

function findBlock(dateStr, id) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return null;
  return day.blocks.find((b) => b.id === id) || null;
}

function setBlockStatus(dateStr, id, status, extra = {}) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return null;
  const block = day.blocks.find((b) => b.id === id);
  if (!block) return null;
  block.status = status;
  Object.assign(block, extra);
  save(store);
  return block;
}

function computeDayStats(dateStr) {
  const store = load();
  const day = store.days[dateStr];
  const blocks = day ? day.blocks : [];
  const total = blocks.length;
  const done = blocks.filter((b) => b.status === 'done').length;
  const skipped = blocks.filter((b) => b.status === 'skipped').length;
  const missed = blocks.filter((b) => b.status === 'missed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, skipped, missed, pct };
}

function getStreak() {
  return load().streak;
}

function getOwnerChatId() {
  return load().ownerChatId;
}

function setOwnerChatId(chatId) {
  const store = load();
  store.ownerChatId = chatId;
  save(store);
}

function finalizeDay(dateStr) {
  const store = load();
  const day = store.days[dateStr];
  if (!day || day.blocks.length === 0) return;
  const stats = computeDayStats(dateStr);
  const clean = stats.total > 0 && stats.missed === 0;
  store.history[dateStr] = { ...stats, clean };
  if (clean) {
    store.streak.current += 1;
    if (store.streak.current > store.streak.longest) {
      store.streak.longest = store.streak.current;
    }
  } else {
    store.streak.current = 0;
  }
  save(store);
}

function ensureRollover() {
  const store = load();
  const today = todayStr();
  if (store.lastRolloverDate !== today) {
    const prev = store.lastRolloverDate;
    finalizeDay(prev);
    const fresh = load();
    fresh.lastRolloverDate = today;
    save(fresh);
  }
}

module.exports = {
  STATUSES,
  todayStr,
  tomorrowStr,
  dateStrOffset,
  nowHHMM,
  normalizeTime,
  getDay,
  addBlock,
  editBlock,
  deleteBlock,
  findBlock,
  setBlockStatus,
  pauseBlock,
  resumeBlock,
  computeDayStats,
  getStreak,
  getOwnerChatId,
  setOwnerChatId,
  finalizeDay,
  ensureRollover,
};
