(function () {
  'use strict';

  const STATUS_ICON = {
    planned: '○', alerting: '◉', in_progress: '◐', paused: '‖',
    done: '●', skipped: '–', missed: '✕',
  };

  const el = (id) => document.getElementById(id);

  const clockEl = el('clock');
  const dateLabelEl = el('dateLabel');
  const streakNumEl = el('streakNum');
  const streakBestEl = el('streakBest');

  const nowCardEl = el('nowCard');
  const nowEyebrowEl = el('nowEyebrow');
  const nowTitleEl = el('nowTitle');
  const nowTimeEl = el('nowTime');
  const nowActionsEl = el('nowActions');
  const progressFillEl = el('progressFill');
  const progressLabelEl = el('progressLabel');
  const timelineEl = el('timeline');
  const emptyViewEl = el('emptyView');
  const viewDateLabelEl = el('viewDateLabel');

  const qaDatesEl = el('qaDates');
  const viewPrevBtn = el('viewPrevBtn');
  const viewNextBtn = el('viewNextBtn');

  const quickAddFormEl = el('quickAddForm');
  const qaTextEl = el('qaText');
  const qaErrorEl = el('qaError');

  const alertOverlayEl = el('alertOverlay');
  const alertTitleEl = el('alertTitle');
  const alertTimeEl = el('alertTime');
  const alertStartBtnEl = el('alertStartBtn');
  const alertSkipBtnEl = el('alertSkipBtn');
  const soundArmEl = el('soundArm');

  const skipConfirmOverlayEl = el('skipConfirmOverlay');
  const scTaskTitleEl = el('scTaskTitle');
  const scCancelBtnEl = el('scCancelBtn');
  const scConfirmBtnEl = el('scConfirmBtn');

  const deleteConfirmOverlayEl = el('deleteConfirmOverlay');
  const dcTaskTitleEl = el('dcTaskTitle');
  const dcCancelBtnEl = el('dcCancelBtn');
  const dcConfirmBtnEl = el('dcConfirmBtn');

  const activeBannerEl = el('activeBanner');
  const abEyebrowEl = el('abEyebrow');
  const abTitleEl = el('abTitle');
  const abTimeEl = el('abTime');
  const abActionsEl = el('abActions');

  const greetingHelloEl = el('greetingHello');
  const greetingNameEl = el('greetingName');
  const greetingSubEl = el('greetingSub');
  const celebrateLayerEl = el('celebrateLayer');
  const toastEl = el('toast');

  const state = {
    meta: null,
    today: { blocks: [], stats: { total: 0, done: 0, skipped: 0, missed: 0, pct: 0 } },
    streak: { current: 0, longest: 0 },
    viewDate: null,
    viewBlocks: [],
    viewStats: { total: 0, done: 0, skipped: 0, missed: 0, pct: 0 },
    activeAlertId: null,
    activeBannerId: null,
    lastKnownStatuses: {},
    dayCompleteDate: null,
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatTime12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${pad(m)} ${period}`;
  }

  function formatRange12(start, end) {
    return `${formatTime12(start)} – ${formatTime12(end)}`;
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function viewDateHeading(dateStr) {
    if (!dateStr || !state.meta) return '';
    if (dateStr === state.meta.today) return 'Today';
    if (dateStr === state.meta.tomorrow) return `Tomorrow · ${formatDateLabel(dateStr)}`;
    return formatDateLabel(dateStr);
  }

  /* ---------------- Greeting ---------------- */

  const GREETING_NAME_KEY = 'worstwork_greeting_name';

  const DEFAULT_GREETING_NAME = 'AYB, Ape';

  function loadGreetingName() {
    try { return localStorage.getItem(GREETING_NAME_KEY) || DEFAULT_GREETING_NAME; } catch (e) { return DEFAULT_GREETING_NAME; }
  }
  function saveGreetingName(name) {
    try { localStorage.setItem(GREETING_NAME_KEY, name); } catch (e) { /* storage unavailable */ }
  }

  function timeGreetingWord() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Good night';
  }

  const SUB_EMPTY = [
    'Nothing on the books yet — add your first task below.',
    "A blank slate. Let's fill it in.",
    'Nothing planned yet — type something above.',
  ];
  const SUB_PROGRESS = [
    (r) => `${r} task${r === 1 ? '' : 's'} to go — you've got this.`,
    (r) => `${r} left. Keep the streak alive.`,
    (r) => `${r} more and today's a clean sweep.`,
  ];
  const SUB_DONE = [
    'Every task handled. That’s a clean day. 🔥',
    'All done — nothing left standing.',
    'Cleared the board. Well done.',
  ];

  function pickPhrase(arr, seed) {
    return arr[((seed % arr.length) + arr.length) % arr.length];
  }

  function updateGreeting() {
    greetingHelloEl.textContent = timeGreetingWord();

    const isToday = state.viewDate === (state.meta && state.meta.today);
    const blocks = state.viewBlocks || [];
    const total = blocks.length;

    if (!isToday) {
      greetingSubEl.textContent = total
        ? `${total} task${total === 1 ? '' : 's'} planned for ${viewDateHeading(state.viewDate)}.`
        : `Nothing planned for ${viewDateHeading(state.viewDate)} yet.`;
      return;
    }

    const resolved = blocks.filter((b) => ['done', 'skipped', 'missed'].includes(b.status)).length;
    const remaining = total - resolved;
    const seed = total * 31 + resolved;

    if (total === 0) {
      greetingSubEl.textContent = pickPhrase(SUB_EMPTY, seed);
    } else if (remaining === 0) {
      greetingSubEl.textContent = pickPhrase(SUB_DONE, seed);
    } else {
      greetingSubEl.textContent = pickPhrase(SUB_PROGRESS, seed)(remaining);
    }
  }

  greetingNameEl.textContent = loadGreetingName();
  greetingNameEl.addEventListener('blur', () => {
    let name = greetingNameEl.textContent.replace(/\s+/g, ' ').trim();
    if (!name) name = DEFAULT_GREETING_NAME;
    if (name.length > 30) name = name.slice(0, 30);
    greetingNameEl.textContent = name;
    saveGreetingName(name);
  });
  greetingNameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); greetingNameEl.blur(); }
  });

  /* ---------------- Celebration ---------------- */

  let toastTimer = null;

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = '';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }

  function spawnConfetti(count) {
    const colors = ['#ffffff', '#f2b84b', '#6ab8f7', '#52d9a8'];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      const duration = 1.8 + Math.random() * 1.2;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      celebrateLayerEl.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + 0.5) * 1000);
    }
  }

  const DONE_TOASTS = ['Nice work! 🔥', 'Knocked out.', 'One down.', 'Keep it moving.'];

  function detectNewlyCompleted(blocks) {
    const newlyDone = [];
    blocks.forEach((b) => {
      const prev = state.lastKnownStatuses[b.id];
      if (prev !== undefined && prev !== 'done' && b.status === 'done') newlyDone.push(b.id);
    });
    const map = {};
    blocks.forEach((b) => { map[b.id] = b.status; });
    state.lastKnownStatuses = map;
    return newlyDone;
  }

  function parseTimeToken(token) {
    const m = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3] ? m[3].toLowerCase() : null;
    if (min > 59) return null;
    if (mer) {
      if (h > 12 || h < 1) return null;
      if (mer === 'am') h = h === 12 ? 0 : h;
      else h = h === 12 ? 12 : h + 12;
    } else if (h > 23) {
      return null;
    }
    return { h, min, hasMeridiem: !!mer };
  }

  function tokenToHHMM(h, min) { return `${pad(h)}:${pad(min)}`; }

  // Parses "9am-10:30am Title", "9-10am Title", "14:00 Title", or plain "Title" (no time).
  function parseQuickAdd(raw) {
    const text = raw.trim();
    if (!text) return null;

    let m = text.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(.+)$/i);
    if (m) {
      const startTok = parseTimeToken(m[1]);
      const endTok = parseTimeToken(m[2]);
      const title = m[3].trim();
      if (startTok && endTok && title) {
        let finalStart = startTok;
        if (!startTok.hasMeridiem && endTok.hasMeridiem && startTok.h <= 12) {
          const merSuffix = m[2].trim().match(/am|pm/i)[0];
          const reparsed = parseTimeToken(m[1].trim() + merSuffix);
          if (reparsed) finalStart = reparsed;
        }
        return { start: tokenToHHMM(finalStart.h, finalStart.min), end: tokenToHHMM(endTok.h, endTok.min), title };
      }
    }

    m = text.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(.+)$/i);
    if (m) {
      const startTok = parseTimeToken(m[1]);
      const title = m[2].trim();
      if (startTok && title) {
        const start = tokenToHHMM(startTok.h, startTok.min);
        const endH = (startTok.h + 1) % 24;
        const end = tokenToHHMM(endH, startTok.min);
        return { start, end, title };
      }
    }

    return { start: null, end: null, title: text };
  }

  async function fetchJSON(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
    } catch (networkErr) {
      throw new Error("Can't reach the server. Make sure `npm start` is running in a terminal, and that you're viewing this page at http://localhost:3000 (not opening the file directly).");
    }
    if (!res.ok) {
      let msg = 'Request failed';
      try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* ---------------- Audio alarm ---------------- */

  let audioCtx = null;
  let alarmTimer = null;

  function armAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* audio unavailable */ }
  }

  function playChime() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.28;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    });
  }

  function startAlarmLoop() {
    stopAlarmLoop();
    playChime();
    alarmTimer = setInterval(playChime, 2200);
  }

  function stopAlarmLoop() {
    if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
  }

  soundArmEl.addEventListener('click', () => {
    armAudio();
    soundArmEl.classList.add('armed');
    soundArmEl.textContent = '🔊 Sound on';
  });
  document.addEventListener('pointerdown', function once() {
    armAudio();
    document.removeEventListener('pointerdown', once);
  }, { once: true });

  /* ---------------- Clock ---------------- */

  function tickClock() {
    const d = new Date();
    clockEl.textContent = formatTime12(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    dateLabelEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    greetingHelloEl.textContent = timeGreetingWord();
  }

  /* ---------------- Actions ---------------- */

  function makeBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function startBlock(id) { hideAlertIfMatches(id); fetchJSON(`/api/today/blocks/${id}/start`, { method: 'POST' }).catch(console.error); }
  function doneBlock(id) { fetchJSON(`/api/today/blocks/${id}/done`, { method: 'POST' }).catch(console.error); }
  function skipBlock(id) { hideAlertIfMatches(id); fetchJSON(`/api/today/blocks/${id}/skip`, { method: 'POST' }).catch(console.error); }
  function pauseBlock(id) { fetchJSON(`/api/today/blocks/${id}/pause`, { method: 'POST' }).catch(console.error); }
  function resumeBlock(id) { fetchJSON(`/api/today/blocks/${id}/resume`, { method: 'POST' }).catch(console.error); }

  /* ---------------- Streak + Active banner (always tied to real today) ---------------- */

  let lastStreakCurrent = null;

  function renderStreak() {
    const s = state.streak || { current: 0, longest: 0 };
    if (lastStreakCurrent !== null && s.current > lastStreakCurrent) {
      streakNumEl.classList.remove('pop');
      void streakNumEl.offsetWidth;
      streakNumEl.classList.add('pop');
    }
    lastStreakCurrent = s.current;
    streakNumEl.textContent = s.current;
    streakBestEl.textContent = `best ${s.longest}`;
  }

  function updateActiveBanner(block) {
    if (block) {
      state.activeBannerId = block.id;
      const paused = block.status === 'paused';
      abEyebrowEl.textContent = paused ? 'Paused' : 'Active now';
      abTitleEl.textContent = block.title;
      abTimeEl.textContent = formatRange12(block.start, block.end);
      abActionsEl.innerHTML = '';
      if (paused) {
        abActionsEl.appendChild(makeBtn('Resume', 'btn-primary', () => resumeBlock(block.id)));
        abActionsEl.appendChild(makeBtn('Skip', 'btn-ghost', () => requestSkip(block.id, block.title)));
      } else {
        abActionsEl.appendChild(makeBtn('Mark done', 'btn-primary', () => doneBlock(block.id)));
        abActionsEl.appendChild(makeBtn('Pause', 'btn-ghost', () => pauseBlock(block.id)));
        abActionsEl.appendChild(makeBtn('Skip', 'btn-ghost', () => requestSkip(block.id, block.title)));
      }
      activeBannerEl.hidden = false;
      document.body.classList.add('has-active-banner');
    } else {
      state.activeBannerId = null;
      activeBannerEl.hidden = true;
      document.body.classList.remove('has-active-banner');
    }
  }

  function liveBlock() {
    return (state.today.blocks || []).find((b) => b.status === 'in_progress' || b.status === 'paused');
  }

  async function refreshLiveToday() {
    const data = await fetchJSON('/api/today');
    state.today = { blocks: data.blocks, stats: data.stats };
    state.streak = data.streak;
    updateActiveBanner(liveBlock());
    renderStreak();
  }

  /* ---------------- Rendering: main view (whichever day is selected) ---------------- */

  function renderView() {
    const isToday = state.viewDate === (state.meta && state.meta.today);
    const blocks = state.viewBlocks || [];
    const stats = state.viewStats || { total: 0, done: 0, skipped: 0, missed: 0, pct: 0 };

    viewDateLabelEl.textContent = viewDateHeading(state.viewDate);
    updateGreeting();

    emptyViewEl.hidden = blocks.length !== 0;
    emptyViewEl.textContent = isToday
      ? 'Nothing planned for today. Add one above to get started.'
      : `Nothing planned for ${formatDateLabel(state.viewDate)} yet. Add one above.`;
    nowCardEl.style.display = blocks.length ? '' : 'none';
    nowCardEl.parentElement.querySelector('.progress-row').style.display = (blocks.length && isToday) ? '' : 'none';

    if (!blocks.length) {
      timelineEl.innerHTML = '';
      return;
    }

    if (isToday) {
      progressFillEl.style.width = stats.pct + '%';
      progressLabelEl.textContent = `${stats.done} / ${stats.total} done`;
    }

    nowCardEl.classList.remove('state-alerting', 'state-missed');
    nowActionsEl.innerHTML = '';

    if (isToday) {
      const stillComplete = blocks.length > 0 && blocks.every((b) => ['done', 'skipped', 'missed'].includes(b.status));
      if (!stillComplete && state.dayCompleteDate === state.viewDate) state.dayCompleteDate = null;

      const alerting = blocks.find((b) => b.status === 'alerting');
      if (alerting) {
        nowCardEl.classList.add('state-alerting');
        nowEyebrowEl.textContent = 'Time to start';
        nowTitleEl.textContent = alerting.title;
        nowTimeEl.textContent = formatRange12(alerting.start, alerting.end);
        nowActionsEl.appendChild(makeBtn('Start now', 'btn-primary', () => startBlock(alerting.id)));
        nowActionsEl.appendChild(makeBtn('Skip', 'btn-ghost', () => requestSkip(alerting.id, alerting.title)));
      } else {
        const next = blocks.find((b) => b.status === 'planned');
        if (next) {
          nowEyebrowEl.textContent = 'Up next';
          nowTitleEl.textContent = next.title;
          nowTimeEl.textContent = formatRange12(next.start, next.end);
          nowActionsEl.appendChild(makeBtn('Start now', 'btn-ghost', () => startBlock(next.id)));
        } else {
          const allDone = blocks.every((b) => ['done', 'skipped', 'missed'].includes(b.status));
          const active = blocks.find((b) => b.status === 'in_progress' || b.status === 'paused');
          if (allDone) {
            nowEyebrowEl.textContent = 'Day complete';
            nowTitleEl.textContent = `${stats.done} done · ${stats.skipped} skipped · ${stats.missed} missed`;
            if (state.dayCompleteDate !== state.viewDate) {
              state.dayCompleteDate = state.viewDate;
              spawnConfetti(46);
              showToast('🔥 Day complete — every task handled.');
            }
          } else if (active) {
            nowEyebrowEl.textContent = active.status === 'paused' ? 'Paused' : 'In progress';
            nowTitleEl.textContent = 'Tracked above — nothing else queued yet';
          } else {
            nowEyebrowEl.textContent = 'Status';
            nowTitleEl.textContent = '—';
          }
          nowTimeEl.textContent = '';
        }
      }
    } else {
      const doneCt = blocks.filter((b) => b.status === 'done').length;
      nowEyebrowEl.textContent = viewDateHeading(state.viewDate);
      nowTitleEl.textContent = `${blocks.length} task${blocks.length === 1 ? '' : 's'} planned`;
      nowTimeEl.textContent = doneCt ? `${doneCt} already done` : '';
    }

    const newlyDone = isToday ? detectNewlyCompleted(blocks) : [];
    if (newlyDone.length) showToast(pickPhrase(DONE_TOASTS, newlyDone.length + blocks.length));

    timelineEl.innerHTML = '';
    blocks.forEach((b, i) => {
      const canDelete = b.status !== 'done';
      const row = document.createElement('div');
      row.className = `tl-row st-${b.status}`;
      row.style.animationDelay = `${Math.min(i, 10) * 35}ms`;
      row.innerHTML = `
        <div class="tl-time">${formatRange12(b.start, b.end)}</div>
        <div class="tl-icon">${STATUS_ICON[b.status] || '○'}</div>
        <div class="tl-title">${escapeHtml(b.title)}</div>
        <button class="icon-btn tl-edit-btn" type="button" title="Rename / reschedule">✎</button>
        <button class="icon-btn tl-del-btn" type="button" title="${canDelete ? 'Delete' : "Completed tasks can't be deleted"}" ${canDelete ? '' : 'disabled'}>✕</button>
      `;
      row.querySelector('.tl-edit-btn').addEventListener('click', () => openEditRow(row, b, state.viewDate, renderView));
      if (canDelete) {
        row.querySelector('.tl-del-btn').addEventListener('click', () => requestDelete(b.id, state.viewDate, b.title));
      }
      if (newlyDone.includes(b.id)) {
        row.classList.add('just-completed');
        row.addEventListener('animationend', () => row.classList.remove('just-completed'), { once: true });
      }
      timelineEl.appendChild(row);
    });
  }

  function openEditRow(row, b, dateStr, onCancel) {
    row.className = 'edit-form';
    row.innerHTML = `
      <input type="time" class="e-start" value="${b.start}">
      <span class="dash">–</span>
      <input type="time" class="e-end" value="${b.end}">
      <input type="text" class="e-title" value="${escapeHtml(b.title)}">
      <button class="btn-primary e-save" type="button">Save</button>
      <button class="btn-ghost e-cancel" type="button">Cancel</button>
    `;
    row.querySelector('.e-title').focus();
    row.querySelector('.e-save').addEventListener('click', async () => {
      const patch = {
        start: row.querySelector('.e-start').value,
        end: row.querySelector('.e-end').value,
        title: row.querySelector('.e-title').value,
      };
      try {
        await fetchJSON(`/api/day/${dateStr}/blocks/${b.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      } catch (e) { alert(e.message); }
    });
    row.querySelector('.e-cancel').addEventListener('click', onCancel);
  }

  async function loadView(dateStr) {
    state.viewDate = dateStr;
    renderQaDates();
    try {
      const data = await fetchJSON(`/api/day/${dateStr}`);
      state.viewBlocks = data.blocks;
      state.viewStats = data.stats;
      renderView();
    } catch (e) { console.error(e); }
  }

  function shiftViewDate(delta) {
    const d = new Date(state.viewDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    loadView(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }

  viewPrevBtn.addEventListener('click', () => shiftViewDate(-1));
  viewNextBtn.addEventListener('click', () => shiftViewDate(1));

  /* ---------------- Quick add (one-line, chat-style) ---------------- */

  function dateChipLabel(dateStr, index) {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
  }

  function renderQaDates() {
    const week = (state.meta && state.meta.week) || [];
    qaDatesEl.innerHTML = '';
    week.forEach((dateStr, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'qa-date-chip' + (dateStr === state.viewDate ? ' active' : '');
      chip.textContent = dateChipLabel(dateStr, i);
      chip.addEventListener('click', () => loadView(dateStr));
      qaDatesEl.appendChild(chip);
    });
  }

  quickAddFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    qaErrorEl.hidden = true;
    const parsed = parseQuickAdd(qaTextEl.value);
    if (!parsed || !parsed.title) {
      qaErrorEl.textContent = 'Type a task (optionally starting with a time, like "9am-10:30am Edit video").';
      qaErrorEl.hidden = false;
      return;
    }
    const targetDate = state.viewDate || (state.meta && state.meta.today);
    const body = { title: parsed.title };
    if (parsed.start) body.start = parsed.start;
    if (parsed.end) body.end = parsed.end;
    try {
      await fetchJSON(`/api/day/${targetDate}/blocks`, { method: 'POST', body: JSON.stringify(body) });
      qaTextEl.value = '';
      qaTextEl.focus();
    } catch (err) {
      qaErrorEl.textContent = err.message;
      qaErrorEl.hidden = false;
    }
  });

  /* ---------------- Alert overlay ---------------- */

  function showAlert(block) {
    state.activeAlertId = block.id;
    alertTitleEl.textContent = block.title;
    alertTimeEl.textContent = formatRange12(block.start, block.end);
    alertOverlayEl.hidden = false;
    startAlarmLoop();
  }

  function hideAlert() {
    state.activeAlertId = null;
    alertOverlayEl.hidden = true;
    stopAlarmLoop();
  }

  function hideAlertIfMatches(id) {
    if (state.activeAlertId === id) hideAlert();
  }

  function checkAlertResolved() {
    if (!state.activeAlertId) return;
    const b = (state.today.blocks || []).find((x) => x.id === state.activeAlertId);
    if (!b || b.status !== 'alerting') hideAlert();
  }

  alertStartBtnEl.addEventListener('click', () => { if (state.activeAlertId) startBlock(state.activeAlertId); });
  alertSkipBtnEl.addEventListener('click', () => {
    if (state.activeAlertId) requestSkip(state.activeAlertId, alertTitleEl.textContent);
  });

  /* ---------------- Skip confirmation (hard to skip) ---------------- */

  let skipTargetId = null;
  let skipCountdownTimer = null;

  function requestSkip(id, title) {
    skipTargetId = id;
    scTaskTitleEl.textContent = title;
    skipConfirmOverlayEl.hidden = false;

    let remaining = 3;
    scConfirmBtnEl.disabled = true;
    scConfirmBtnEl.textContent = `Yes, skip it (${remaining})`;
    if (skipCountdownTimer) clearInterval(skipCountdownTimer);
    skipCountdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(skipCountdownTimer);
        skipCountdownTimer = null;
        scConfirmBtnEl.disabled = false;
        scConfirmBtnEl.textContent = 'Yes, skip it';
      } else {
        scConfirmBtnEl.textContent = `Yes, skip it (${remaining})`;
      }
    }, 1000);
  }

  function closeSkipConfirm() {
    skipConfirmOverlayEl.hidden = true;
    if (skipCountdownTimer) { clearInterval(skipCountdownTimer); skipCountdownTimer = null; }
    skipTargetId = null;
  }

  scCancelBtnEl.addEventListener('click', closeSkipConfirm);
  scConfirmBtnEl.addEventListener('click', () => {
    if (skipTargetId) skipBlock(skipTargetId);
    closeSkipConfirm();
  });

  /* ---------------- Delete confirmation ---------------- */

  let deleteTargetId = null;
  let deleteTargetDate = null;

  function requestDelete(id, dateStr, title) {
    deleteTargetId = id;
    deleteTargetDate = dateStr;
    dcTaskTitleEl.textContent = title;
    deleteConfirmOverlayEl.hidden = false;
  }

  function closeDeleteConfirm() {
    deleteConfirmOverlayEl.hidden = true;
    deleteTargetId = null;
    deleteTargetDate = null;
  }

  dcCancelBtnEl.addEventListener('click', closeDeleteConfirm);
  dcConfirmBtnEl.addEventListener('click', () => {
    if (deleteTargetId && deleteTargetDate) {
      fetchJSON(`/api/day/${deleteTargetDate}/blocks/${deleteTargetId}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    }
    closeDeleteConfirm();
  });

  /* ---------------- Socket.io ---------------- */

  const socket = io();

  socket.on('day:update', (payload) => {
    if (!state.meta) return;
    if (payload.date === state.meta.today) {
      state.today = { blocks: payload.blocks, stats: payload.stats };
      updateActiveBanner(liveBlock());
      checkAlertResolved();
    }
    if (payload.date === state.viewDate) {
      state.viewBlocks = payload.blocks;
      state.viewStats = payload.stats;
      renderView();
    }
  });

  socket.on('streak:update', (streak) => {
    state.streak = streak;
    renderStreak();
  });

  socket.on('block:alert', (payload) => {
    if (!state.meta || payload.date !== state.meta.today) return;
    showAlert(payload.block);
  });

  /* ---------------- Init ---------------- */

  async function refreshMetaAndRollover() {
    try {
      const meta = await fetchJSON('/api/meta');
      const dayChanged = state.meta && meta.today !== state.meta.today;
      state.meta = meta;
      if (dayChanged) {
        refreshLiveToday();
        loadView(meta.today);
      } else {
        renderQaDates();
      }
    } catch (e) { /* server unreachable, ignore this cycle */ }
  }

  async function init() {
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshMetaAndRollover, 60000);

    const meta = await fetchJSON('/api/meta');
    state.meta = meta;

    await refreshLiveToday();
    await loadView(meta.today);
  }

  init().catch((e) => console.error('init failed', e));
})();
