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

Open **http://localhost:3000** in a browser and put that window/tab full-screen on the monitor. The server only listens on your machine (`127.0.0.1`) — nothing on your network can reach it.

If you set up the bot, open Telegram, find your bot, and send `/start` — that links your chat so alerts and `/today`, `/addtomorrow`, etc. work.

Click anywhere on the dashboard once (or hit the "Enable sound" pill, bottom-right) so the browser is allowed to play the alarm sound — browsers block audio until you've interacted with the page at least once per load.

## Daily workflow

- **Quick-add bar** (top of the page, always visible): pick Today or Tomorrow, set a start/end time, type the task, hit send — like typing into a chat box. Use it each night to lay out tomorrow.
- **Today tab** is the display view: the current/next task is shown large, with a live progress bar and a full timeline underneath.
- **Plan tab** lets you browse any day (‹ › or the Today/Tomorrow buttons), and edit or delete blocks already on the schedule.
- When a task's start time arrives, it goes into **alerting**: the screen flashes, the alarm chimes on a loop, and (if linked) Telegram messages you with **Start** / **Skip** buttons. Nothing dismisses it except you.
- Once you hit **Start**, the task takes over the **top quarter of the screen** as a black "Active now" banner with Mark done / Skip — so it's unmistakable that something is running, no matter which tab you're on.
- **Skip is deliberately hard**: it always asks "Are you sure?" and the confirm button stays disabled for a 3-second countdown before you can actually skip. Starting the task is always one click; skipping never is.
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
