# WORSTWORK Tracker

A daily planner + accountability tracker built to live full-screen on a monitor. Add tasks in a chat-style bar at the top; when a task's start time hits, the screen flashes and plays a sound until you acknowledge it, and once it's underway it takes over the top quarter of the screen so you always know what's active. Also reachable from a Telegram bot so you can plan or check off tasks from your phone.

## Requirements

- Node.js 18 or newer ([nodejs.org](https://nodejs.org), or `brew install node` on a Mac)
- A Telegram account (free) if you want the phone integration — optional, the dashboard works without it

## Setup (first time)

```bash
npm install
cp .env.example .env
```

### Connect Telegram (optional but recommended)

1. In Telegram, message **[@BotFather](https://t.me/BotFather)** → `/newbot` → follow the prompts → it gives you a token like `123456:ABC-xyz...`
2. Open `.env` and paste it into `TELEGRAM_BOT_TOKEN=`
3. Leave `TELEGRAM_CHAT_ID` blank — it fills itself in the first time you message the bot

### Run it

```bash
npm start
```

Open **http://localhost:3000** in a browser and put that window/tab full-screen on the monitor.

If you set up the bot, open Telegram, find your bot, and send `/start` — that links your chat so alerts and `/today`, `/addtomorrow`, etc. work.

Click anywhere on the dashboard once (or hit the "Enable sound" pill, bottom-right) so the browser is allowed to play the alarm sound — browsers block audio until you've interacted with the page at least once per load.

## Daily workflow

- **Day chips** (top of the page, always visible: ‹ Today Tomorrow Sun Mon Tue Wed Thu ›) pick which day you're looking at *and* which day new tasks go to — they're the same selection, so whatever you're viewing is where the quick-add drops the next task. ‹ › step one day at a time beyond the week shown.
- **Quick-add bar**: type the task, hit send. Three ways to type it:
  - Just the task — `Pack shipping orders` — it auto-slots right after the last task on that day (or starting now, if the day's empty).
  - A single time — `2pm Call fabric supplier` or `14:00 Call fabric supplier` — defaults to a 1-hour block.
  - A time range — `9am-10:30am Edit YouTube video` or `9-10:30 Edit YouTube video` — uses exactly that window.
- Viewing **today** gives you the full live experience: current/next task shown large, a live progress bar, and Start/Skip/Pause controls. Viewing any other day shows a simple read-only-style list (you can still rename or delete tasks) since those actions only make sense for what's happening right now.
- When a task's start time arrives, it goes into **alerting**: the screen flashes, the alarm chimes on a loop, and (if linked) Telegram messages you with **Start** / **Skip** buttons. Nothing dismisses it except you.
- Once you hit **Start**, the task takes over the **top quarter of the screen** as a dark "Active now" banner with Mark done / Pause / Skip — so it's unmistakable that something is running, no matter what day you're browsing.
- **Pause** it if you need to step away — hit **Resume** when you're back and the task's end time, plus every task after it that day, shifts forward by exactly however long you were gone. Already-completed tasks are never touched.
- **Skip is deliberately hard**: it always asks "Are you sure?" and the confirm button stays disabled for a 3-second countdown before you can actually skip. Starting the task is always one click; skipping never is.
- **Rename or delete** any task from the ✎ / ✕ icons next to it (hover to reveal). Deleting also asks for confirmation. **Completed tasks can't be deleted** — that's on purpose, so the record of what you actually got done stays intact.
- If a task is never acknowledged before its end time, it's marked **missed** and shows in red in the timeline.
- The streak badge (top right) counts consecutive "clean" days — every task that day ended up done or skipped, nothing missed.

## Telegram commands

```
/start              link this chat to the tracker
/today               list today's tasks
/tomorrow            list tomorrow's tasks
/addtoday 14:00-15:00 Reply to emails
/addtomorrow 09:00-10:30 Edit YouTube video
/done 2              mark task #2 (from /today) done
/skip 2               skip task #2
/status               streak + today's completion
```

Times in commands are 24-hour (`14:00`); everything the bot shows back to you is in 12-hour format. Tapping the inline "Skip" button also asks for confirmation before it commits.

## Keeping it running

The alarm and Telegram bot only work while `npm start` is running. Leave the Terminal window open alongside the browser tab. If you want it to survive Terminal being closed, install [pm2](https://pm2.keymetrics.io/) once (`npm install -g pm2`) and run `pm2 start server/index.js --name worstwork` instead of `npm start`.

## Data

Everything is stored locally in `data/store.json` (created automatically, never committed to git — it's in `.gitignore`). Nothing leaves your machine except the Telegram messages you've opted into.
