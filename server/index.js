require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const scheduler = require('./scheduler');
const telegramBot = require('./telegramBot');
const tasksRouter = require('./routes/tasks');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', tasksRouter(io));

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

const notifier = telegramBot.init(io);
scheduler.start(io, notifier);

server.listen(PORT, HOST, () => {
  console.log(`WORSTWORK tracker running at http://localhost:${PORT} (bound to ${HOST} only)`);
});
