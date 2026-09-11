(function () {
  'use strict';

  const STATUS_ICON = { planned: '○', alerting: '◉', in_progress: '◐', done: '●', skipped: '–', missed: '✕' };

  const el = (id) => document.getElementById(id);

  const clockEl = el('clock');
  const dateLabelEl = el('dateLabel');
  const streakNumEl = el('streakNum');
  const streakBestEl = el('streakBest');

  const todayViewEl = el('todayView');
  const planViewEl = el('planView');

  const nowCardEl = el('nowCard');
  const nowEyebrowEl = el('nowEyebrow');
  const nowTitleEl = el('nowTitle');
  const nowTimeEl = el('nowTime');
  const nowActionsEl = el('nowActions');
  const progressFillEl = el('progressFill');
  const progressLabelEl = el('progressLabel');
  const timelineEl = el('timeline');
  const emptyTodayEl = el('emptyToday');

  const planPrevBtn = el('planPrev');
  const planTodayBtn = el('planToday');
  const planTomorrowBtn = el('planTomorrow');
  const planNextBtn = el('planNext');
  const planDateLabelEl = el('planDateLabel');
  const planListEl = el('planList');
  const emptyPlanEl = el('emptyPlan');

  const quickAddFormEl = el('quickAddForm');
  const qaStartEl = el('qaStart');
  const qaEndEl = el('qaEnd');
  const qaTextEl = el('qaText');
  const qaErrorEl = el('qaError');
  const qaDateBtns = Array.from(document.querySelectorAll('.qa-date-btn'));

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

  const activeBannerEl = el('activeBanner');
  const abTitleEl = el('abTitle');
  const abTimeEl = el('abTime');
  const abDoneBtnEl = el('abDoneBtn');
  const abSkipBtnEl = el('abSkipBtn');

  const state = {
    meta: null,
    today: { blocks: [], stats: { total: 0, done: 0, skipped: 0, missed: 0, pct: 0 } },
    streak: { current: 0, longest: 0 },
    planDate: null,
    planBlocks: [],
    activeAlertId: null,
    activeBannerId: null,
    qaDateMode: 'today',
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
  }

  /* ---------------- Rendering: Today ---------------- */

  function makeBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderStreak() {
    const s = state.streak || { current: 0, longest: 0 };
    streakNumEl.textContent = s.current;
    streakBestEl.textContent = `best ${s.longest}`;
  }

  function updateActiveBanner(block) {
    if (block) {
      state.activeBannerId = block.id;
      abTitleEl.textContent = block.title;
      abTimeEl.textContent = formatRange12(block.start, block.end);
      activeBannerEl.hidden = false;
      document.body.classList.add('has-active-banner');
    } else {
      state.activeBannerId = null;
      activeBannerEl.hidden = true;
      document.body.classList.remove('has-active-banner');
    }
  }

  abDoneBtnEl.addEventListener('click', () => { if (state.activeBannerId) doneBlock(state.activeBannerId); });
  abSkipBtnEl.addEventListener('click', () => {
    if (state.activeBannerId) requestSkip(state.activeBannerId, abTitleEl.textContent);
  });

  function renderToday() {
    const blocks = state.today.blocks || [];
    const stats = state.today.stats || { total: 0, done: 0, skipped: 0, missed: 0, pct: 0 };

    emptyTodayEl.hidden = blocks.length !== 0;
    nowCardEl.style.display = blocks.length ? '' : 'none';
    nowCardEl.parentElement.querySelector('.progress-row').style.display = blocks.length ? '' : 'none';

    updateActiveBanner(blocks.find((b) => b.status === 'in_progress'));

    if (!blocks.length) {
      timelineEl.innerHTML = '';
      return;
    }

    progressFillEl.style.width = stats.pct + '%';
    progressLabelEl.textContent = `${stats.done} / ${stats.total} done`;

    nowCardEl.classList.remove('state-alerting', 'state-missed');
    nowActionsEl.innerHTML = '';

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
        const inProgress = blocks.find((b) => b.status === 'in_progress');
        if (allDone) {
          nowEyebrowEl.textContent = 'Day complete';
          nowTitleEl.textContent = `${stats.done} done · ${stats.skipped} skipped · ${stats.missed} missed`;
        } else if (inProgress) {
          nowEyebrowEl.textContent = 'In progress';
          nowTitleEl.textContent = 'Tracked above — nothing else queued yet';
        } else {
          nowEyebrowEl.textContent = 'Status';
          nowTitleEl.textContent = '—';
        }
        nowTimeEl.textContent = '';
      }
    }

    timelineEl.innerHTML = '';
    blocks.forEach((b) => {
      const row = document.createElement('div');
      row.className = `tl-row st-${b.status}`;
      row.innerHTML = `
        <div class="tl-time">${formatRange12(b.start, b.end)}</div>
        <div class="tl-icon">${STATUS_ICON[b.status] || '○'}</div>
        <div class="tl-title">${escapeHtml(b.title)}</div>
      `;
      timelineEl.appendChild(row);
    });
  }

  function startBlock(id) { hideAlertIfMatches(id); fetchJSON(`/api/today/blocks/${id}/start`, { method: 'POST' }).catch(console.error); }
  function doneBlock(id) { fetchJSON(`/api/today/blocks/${id}/done`, { method: 'POST' }).catch(console.error); }
  function skipBlock(id) { hideAlertIfMatches(id); fetchJSON(`/api/today/blocks/${id}/skip`, { method: 'POST' }).catch(console.error); }

  async function loadToday() {
    const data = await fetchJSON('/api/today');
    state.today = data;
    state.streak = data.streak;
    renderToday();
    renderStreak();
  }

  /* ---------------- Rendering: Plan ---------------- */

  function renderPlan() {
    const blocks = state.planBlocks || [];
    planDateLabelEl.textContent = formatDateLabel(state.planDate);
    emptyPlanEl.hidden = blocks.length !== 0;
    planListEl.innerHTML = '';
    blocks.forEach((b) => {
      const li = document.createElement('li');
      li.className = 'plan-row';
      li.innerHTML = `
        <div class="pr-time">${formatRange12(b.start, b.end)}</div>
        <div class="pr-title">${escapeHtml(b.title)}</div>
        <button class="icon-btn edit-btn" type="button" title="Edit">✎</button>
        <button class="icon-btn del-btn" type="button" title="Delete">✕</button>
      `;
      li.querySelector('.edit-btn').addEventListener('click', () => openEditRow(li, b));
      li.querySelector('.del-btn').addEventListener('click', () => deleteBlockReq(b.id));
      planListEl.appendChild(li);
    });
  }

  function openEditRow(li, b) {
    li.className = 'edit-form';
    li.innerHTML = `
      <input type="time" class="e-start" value="${b.start}">
      <span class="dash">–</span>
      <input type="time" class="e-end" value="${b.end}">
      <input type="text" class="e-title" value="${escapeHtml(b.title)}">
      <button class="btn-primary e-save" type="button">Save</button>
      <button class="btn-ghost e-cancel" type="button">Cancel</button>
    `;
    li.querySelector('.e-save').addEventListener('click', async () => {
      const patch = {
        start: li.querySelector('.e-start').value,
        end: li.querySelector('.e-end').value,
        title: li.querySelector('.e-title').value,
      };
      try {
        await fetchJSON(`/api/day/${state.planDate}/blocks/${b.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      } catch (e) { alert(e.message); }
    });
    li.querySelector('.e-cancel').addEventListener('click', renderPlan);
  }

  function deleteBlockReq(id) {
    if (!confirm('Delete this block?')) return;
    fetchJSON(`/api/day/${state.planDate}/blocks/${id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
  }

  async function loadPlanDay(date) {
    state.planDate = date;
    try {
      const data = await fetchJSON(`/api/day/${date}`);
      state.planBlocks = data.blocks;
      renderPlan();
    } catch (e) { console.error(e); }
  }

  function shiftPlanDate(delta) {
    const d = new Date(state.planDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    loadPlanDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }

  planPrevBtn.addEventListener('click', () => shiftPlanDate(-1));
  planNextBtn.addEventListener('click', () => shiftPlanDate(1));
  planTodayBtn.addEventListener('click', () => loadPlanDay(state.meta.today));
  planTomorrowBtn.addEventListener('click', () => loadPlanDay(state.meta.tomorrow));

  /* ---------------- Quick add (chat-style) ---------------- */

  qaDateBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      qaDateBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.qaDateMode = btn.dataset.date;
    });
  });

  quickAddFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    qaErrorEl.hidden = true;
    const targetDate = state.qaDateMode === 'tomorrow' ? state.meta.tomorrow : state.meta.today;
    const body = {
      start: qaStartEl.value,
      end: qaEndEl.value,
      title: qaTextEl.value,
    };
    if (!body.start || !body.end || !body.title.trim()) {
      qaErrorEl.textContent = 'Add a start time, end time, and a task title.';
      qaErrorEl.hidden = false;
      return;
    }
    try {
      await fetchJSON(`/api/day/${targetDate}/blocks`, { method: 'POST', body: JSON.stringify(body) });
      qaTextEl.value = '';
      qaTextEl.focus();
    } catch (err) {
      qaErrorEl.textContent = err.message;
      qaErrorEl.hidden = false;
    }
  });

  /* ---------------- Tabs ---------------- */

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      todayViewEl.hidden = view !== 'today';
      planViewEl.hidden = view !== 'plan';
    });
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

  /* ---------------- Socket.io ---------------- */

  const socket = io();

  socket.on('day:update', (payload) => {
    if (!state.meta) return;
    if (payload.date === state.meta.today) {
      state.today = { blocks: payload.blocks, stats: payload.stats, streak: state.streak };
      renderToday();
      checkAlertResolved();
    }
    if (payload.date === state.planDate) {
      state.planBlocks = payload.blocks;
      renderPlan();
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
        loadToday();
        loadPlanDay(meta.tomorrow);
      }
    } catch (e) { /* server unreachable, ignore this cycle */ }
  }

  async function init() {
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshMetaAndRollover, 60000);

    const meta = await fetchJSON('/api/meta');
    state.meta = meta;

    await loadToday();
    await loadPlanDay(meta.tomorrow);
  }

  init().catch((e) => console.error('init failed', e));
})();
