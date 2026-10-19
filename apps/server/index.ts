import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { LobbyRoom } from './src/rooms/LobbyRoom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ═══════════════════════════════════════════════════════════
// STATİK İSTEMCİ DOSYALARI (TV EKRANI & TELEFON KUMANDASI)
// ═══════════════════════════════════════════════════════════
function resolveDist(appName: string): string | null {
  // apps/server/dist -> ../../appName/dist
  const p1 = path.resolve(__dirname, '../../', appName, 'dist');
  if (fs.existsSync(p1)) return p1;
  // apps/server -> ../appName/dist
  const p2 = path.resolve(__dirname, '../', appName, 'dist');
  if (fs.existsSync(p2)) return p2;
  return null;
}

const controllerDist = resolveDist('controller-runtime');
const screenDist = resolveDist('screen-runtime');

if (controllerDist) {
  console.log(`[📱] Controller statik dosyaları yüklendi: ${controllerDist}`);
  // /play ve altındaki statik dosyaları sun
  app.use('/play', express.static(controllerDist));

  // /join isteklerini /play rotasına yönlendir
  app.get(/^\/join(\/.*)?$/, (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/play${query}`);
  });

  // /play altındaki SPA yönlendirmeleri
  app.get(/^\/play(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(controllerDist, 'index.html'));
  });
} else {
  console.log('[ℹ️] Controller dist bulunamadı (geliştirme modundasınız veya henüz build edilmedi).');
}

if (screenDist) {
  console.log(`[📺] Screen statik dosyaları yüklendi: ${screenDist}`);
  // Kök dizindeki statik varlıkları sun
  app.use(express.static(screenDist));

  // Kalan tüm GET isteklerini TV ekranı SPA'sına yönlendir
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      res.sendFile(path.join(screenDist, 'index.html'));
    } else {
      next();
    }
  });
} else {
  console.log('[ℹ️] Screen dist bulunamadı (geliştirme modundasınız veya henüz build edilmedi).');
}

// Port
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 2567;

httpServer.listen(PORT, () => {
  console.log(`[🚀] Platform Sunucusu başlatıldı: Port ${PORT}`);
});
