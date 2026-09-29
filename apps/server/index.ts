import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { LobbyRoom } from './src/rooms/LobbyRoom.js';

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Temel sağlık kontrolü
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'party-platform-server' });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

// Colyseus odasını kaydet
gameServer.define('lobby', LobbyRoom);

// ═══════════════════════════════════════════════════════════
// MATCHMAKER HTTP ROTALAR
// @colyseus/sdk istemcisi şu rotaları kullanır:
//   client.create('lobby')       → POST /matchmake/create/lobby
//   client.joinOrCreate('lobby') → POST /matchmake/joinOrCreate/lobby
//   client.join('lobby')         → POST /matchmake/join/lobby
//   client.joinById(roomId)      → POST /matchmake/joinById/{roomId}
// ═══════════════════════════════════════════════════════════

app.post('/matchmake/create/:roomName', async (req, res) => {
  try {
    const data = await matchMaker.create(req.params.roomName, req.body || {});
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ code: 500, error: e.message });
  }
});

app.post('/matchmake/joinOrCreate/:roomName', async (req, res) => {
  try {
    const data = await matchMaker.joinOrCreate(req.params.roomName, req.body || {});
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ code: 500, error: e.message });
  }
});

app.post('/matchmake/join/:roomName', async (req, res) => {
  try {
    const data = await matchMaker.join(req.params.roomName, req.body || {});
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ code: 500, error: e.message });
  }
});

app.post('/matchmake/joinById/:roomId', async (req, res) => {
  try {
    const data = await matchMaker.joinById(req.params.roomId, req.body || {});
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ code: 500, error: e.message });
  }
});

// Port
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 2567;

httpServer.listen(PORT, () => {
  console.log(`[🚀] Platform Sunucusu başlatıldı: Port ${PORT}`);
});
