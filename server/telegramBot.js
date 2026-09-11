const db = require('./db');

const STATUS_ICON = {
  planned: '○',
  alerting: '◉',
  in_progress: '◐',
  done: '●',
  skipped: '–',
  missed: '✕',
};

function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtBlock(b, i) {
  return `${i + 1}. ${STATUS_ICON[b.status] || '○'} ${fmt12(b.start)}–${fmt12(b.end)}  ${b.title}`;
}

function parseAdd(text) {
  const m = text.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if (!m) return null;
  return { start: m[1], end: m[2], title: m[3].trim() };
}

function init(io) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set — Telegram integration disabled.');
    return { sendAlert: () => {}, sendMissed: () => {}, sendText: () => {} };
  }

  const TelegramBot = require('node-telegram-bot-api');
  const bot = new TelegramBot(token, { polling: true });

  bot.on('polling_error', (err) => console.error('[telegram] polling error:', err.message));

  function broadcastDay(dateStr) {
    const day = db.getDay(dateStr);
    io.emit('day:update', { date: dateStr, blocks: day.blocks, stats: db.computeDayStats(dateStr) });
    io.emit('streak:update', db.getStreak());
  }

  bot.onText(/^\/start/, (msg) => {
    db.setOwnerChatId(msg.chat.id);
    bot.sendMessage(
      msg.chat.id,
      "Linked. This chat now gets WORSTWORK alerts.\n\n" +
        "Commands:\n" +
        "/today — today's plan\n" +
        "/tomorrow — tomorrow's plan\n" +
        "/addtoday 14:00-15:00 Task title\n" +
        "/addtomorrow 09:00-10:30 Task title\n" +
        "/done N — mark block N done (from /today list)\n" +
        "/skip N — skip block N\n" +
        "/status — streak & today's completion\n\n" +
        "Times in commands are 24h (14:00), shown back to you in 12h."
    );
  });

  bot.onText(/^\/help/, (msg) => bot.emit('text', { ...msg, text: '/start' }));

  bot.onText(/^\/today/, (msg) => {
    const day = db.getDay(db.todayStr());
    if (!day.blocks.length) return bot.sendMessage(msg.chat.id, 'Nothing planned for today yet.');
    bot.sendMessage(msg.chat.id, day.blocks.map(fmtBlock).join('\n'));
  });

  bot.onText(/^\/tomorrow/, (msg) => {
    const day = db.getDay(db.tomorrowStr());
    if (!day.blocks.length) return bot.sendMessage(msg.chat.id, 'Nothing planned for tomorrow yet.');
    bot.sendMessage(msg.chat.id, day.blocks.map(fmtBlock).join('\n'));
  });

  bot.onText(/^\/addtoday\s+(.+)/s, (msg, match) => {
    try {
      const parsed = parseAdd(match[1]);
      if (!parsed) return bot.sendMessage(msg.chat.id, 'Format: /addtoday 14:00-15:00 Task title');
      db.addBlock(db.todayStr(), parsed);
      broadcastDay(db.todayStr());
      bot.sendMessage(msg.chat.id, `Added to today: ${fmt12(parsed.start)}–${fmt12(parsed.end)} ${parsed.title}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `Error: ${e.message}`);
    }
  });

  bot.onText(/^\/addtomorrow\s+(.+)/s, (msg, match) => {
    try {
      const parsed = parseAdd(match[1]);
      if (!parsed) return bot.sendMessage(msg.chat.id, 'Format: /addtomorrow 09:00-10:30 Task title');
      db.addBlock(db.tomorrowStr(), parsed);
      broadcastDay(db.tomorrowStr());
      bot.sendMessage(msg.chat.id, `Added to tomorrow: ${fmt12(parsed.start)}–${fmt12(parsed.end)} ${parsed.title}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `Error: ${e.message}`);
    }
  });

  function actOnOrdinal(msg, match, status) {
    const day = db.getDay(db.todayStr());
    const idx = Number(match[1]) - 1;
    const block = day.blocks[idx];
    if (!block) return bot.sendMessage(msg.chat.id, `No block #${match[1]} today. Send /today to see the list.`);
    const extra = status === 'done' ? { doneAt: new Date().toISOString() } : {};
    db.setBlockStatus(db.todayStr(), block.id, status, extra);
    broadcastDay(db.todayStr());
    bot.sendMessage(msg.chat.id, `${status === 'done' ? 'Marked done' : 'Skipped'}: ${block.title}`);
  }

  bot.onText(/^\/done\s+(\d+)/, (msg, match) => actOnOrdinal(msg, match, 'done'));
  bot.onText(/^\/skip\s+(\d+)/, (msg, match) => actOnOrdinal(msg, match, 'skipped'));

  bot.onText(/^\/status/, (msg) => {
    const stats = db.computeDayStats(db.todayStr());
    const streak = db.getStreak();
    bot.sendMessage(
      msg.chat.id,
      `Streak: ${streak.current} day${streak.current === 1 ? '' : 's'} (best ${streak.longest})\n` +
        `Today: ${stats.done}/${stats.total} done, ${stats.missed} missed, ${stats.pct}%`
    );
  });

  bot.on('callback_query', (query) => {
    const [action, id] = query.data.split(':');
    const block = db.findBlock(db.todayStr(), id);
    if (!block) return bot.answerCallbackQuery(query.id, { text: 'Block not found (maybe a new day started).' });
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (action === 'go') {
      db.setBlockStatus(db.todayStr(), id, 'in_progress', { startedAt: new Date().toISOString() });
      bot.answerCallbackQuery(query.id, { text: 'Started.' });
      bot.editMessageText(`◐ Started: ${block.title}`, { chat_id: chatId, message_id: messageId });
      broadcastDay(db.todayStr());
    } else if (action === 'skip') {
      bot.answerCallbackQuery(query.id);
      bot.editMessageText(`Skip "${block.title}"? This breaks today's streak.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Never mind', callback_data: `skipno:${block.id}` },
              { text: 'Yes, skip it', callback_data: `skipyes:${block.id}` },
            ],
          ],
        },
      });
    } else if (action === 'skipyes') {
      db.setBlockStatus(db.todayStr(), id, 'skipped');
      bot.answerCallbackQuery(query.id, { text: 'Skipped.' });
      bot.editMessageText(`– Skipped: ${block.title}`, { chat_id: chatId, message_id: messageId });
      broadcastDay(db.todayStr());
    } else if (action === 'skipno') {
      bot.answerCallbackQuery(query.id, { text: 'Back to it.' });
      bot.editMessageText(`⏰ Time to start: ${block.title}\n${fmt12(block.start)}–${fmt12(block.end)}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶ Start', callback_data: `go:${block.id}` },
              { text: '⏭ Skip', callback_data: `skip:${block.id}` },
            ],
          ],
        },
      });
    }
  });

  function sendAlert(block) {
    const chatId = db.getOwnerChatId();
    if (!chatId) return;
    bot.sendMessage(chatId, `⏰ Time to start: ${block.title}\n${fmt12(block.start)}–${fmt12(block.end)}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '▶ Start', callback_data: `go:${block.id}` },
            { text: '⏭ Skip', callback_data: `skip:${block.id}` },
          ],
        ],
      },
    }).catch((e) => console.error('[telegram] sendAlert failed:', e.message));
  }

  function sendMissed(block) {
    const chatId = db.getOwnerChatId();
    if (!chatId) return;
    bot.sendMessage(chatId, `✕ Missed: ${block.title} (${fmt12(block.start)}–${fmt12(block.end)})`).catch(() => {});
  }

  function sendText(text) {
    const chatId = db.getOwnerChatId();
    if (!chatId) return;
    bot.sendMessage(chatId, text).catch(() => {});
  }

  console.log('[telegram] bot polling started.');
  return { sendAlert, sendMissed, sendText };
}

module.exports = { init };
