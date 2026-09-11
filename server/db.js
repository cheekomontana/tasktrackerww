const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const STATUSES = ['planned', 'alerting', 'in_progress', 'done', 'skipped', 'missed'];

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

function addBlock(dateStr, { start, end, title }) {
  const store = load();
  if (!store.days[dateStr]) store.days[dateStr] = { blocks: [] };
  const ns = normalizeTime(start);
  const ne = normalizeTime(end);
  if (!ns || !ne) throw new Error('Invalid time, use HH:MM');
  if (!title || !title.trim()) throw new Error('Title required');
  const block = {
    id: crypto.randomUUID(),
    start: ns,
    end: ne,
    title: title.trim(),
    status: 'planned',
    startedAt: null,
    doneAt: null,
  };
  store.days[dateStr].blocks.push(block);
  save(store);
  return block;
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
  save(store);
  return block;
}

function deleteBlock(dateStr, id) {
  const store = load();
  const day = store.days[dateStr];
  if (!day) return false;
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
  computeDayStats,
  getStreak,
  getOwnerChatId,
  setOwnerChatId,
  finalizeDay,
  ensureRollover,
};
