#!/usr/bin/env node
/**
 * GymCrush Cross-Device Couple Sync Relay Server
 * Bridges Android Emulator (10.0.2.2), iOS Simulator (localhost), and LAN devices in real time.
 * Can be mounted inside Metro (`metro.config.js` on port 8081) AND run standalone on port 8787.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATE_FILE = path.join(os.tmpdir(), 'gymcrush-couple-room-v1.json');
const MAX_EVENTS = 120;

function createEmptyRoom() {
  return {
    seq: 0,
    updatedAt: Date.now(),
    sharedSession: {
      isActive: false,
      startedAt: null,
      startedBy: null,
      startedByName: null,
    },
    events: [],
  };
}

function readRoomState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.events)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to fresh room
  }
  return createEmptyRoom();
}

function writeRoomState(room) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(room), 'utf8');
  } catch {
    // Ignore transient fs errors
  }
}

function applyEnvelopeToRoom(room, envelope) {
  if (!envelope || !envelope.id || !envelope.event) return room;
  if (room.events.some((e) => e.id === envelope.id)) {
    return room;
  }

  room.seq = (room.seq || 0) + 1;
  room.updatedAt = Date.now();
  const stamped = {
    ...envelope,
    seq: room.seq,
    serverTimestamp: room.updatedAt,
  };

  room.events.push(stamped);
  if (room.events.length > MAX_EVENTS) {
    room.events = room.events.slice(room.events.length - MAX_EVENTS);
  }

  const evt = envelope.event;
  if (evt.type === 'SESSION_STARTED' && evt.payload) {
    room.sharedSession = {
      isActive: true,
      startedAt: evt.payload.startedAt || Date.now(),
      startedBy: evt.payload.startedBy || null,
      startedByName: evt.payload.startedByName || null,
    };
  } else if (evt.type === 'SESSION_FINISHED') {
    room.sharedSession = {
      isActive: false,
      startedAt: null,
      startedBy: null,
      startedByName: null,
    };
  }

  writeRoomState(room);
  return room;
}

function handleSyncRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/__gymcrush_sync', 'http://localhost');

  if (req.method === 'GET') {
    const sinceSeq = parseInt(parsedUrl.searchParams.get('since') || '0', 10) || 0;
    const instanceId = parsedUrl.searchParams.get('instance');
    const userId = parsedUrl.searchParams.get('user');
    const platform = parsedUrl.searchParams.get('platform');

    const room = readRoomState();
    room.peers = room.peers || {};

    if (instanceId) {
      room.peers[instanceId] = {
        instanceId,
        userId: userId || 'unknown',
        platform: platform || 'unknown',
        lastSeen: Date.now(),
      };
    }

    // Clean up peers not seen within 3.5 seconds
    const now = Date.now();
    for (const [id, peer] of Object.entries(room.peers)) {
      if (now - peer.lastSeen > 3500) {
        delete room.peers[id];
      }
    }
    writeRoomState(room);

    const events = room.events.filter((e) => (e.seq || 0) > sinceSeq);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        seq: room.seq || 0,
        sharedSession: room.sharedSession,
        activePeers: Object.values(room.peers),
        events,
      })
    );
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const room = readRoomState();
        if (payload && payload.resetRoom === true) {
          const fresh = createEmptyRoom();
          writeRoomState(fresh);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, seq: 0, sharedSession: fresh.sharedSession }));
          return;
        }
        const updated = applyEnvelopeToRoom(room, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            seq: updated.seq,
            sharedSession: updated.sharedSession,
          })
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
}

function ensureStandaloneRelayServer(port = 8787) {
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/__gymcrush_sync')) {
      handleSyncRequest(req, res);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'GymCrush Couple Sync Relay', status: 'online' }));
  });

  server.on('error', () => {
    // Port 8787 is already bound by another process — safe to ignore
  });

  server.listen(port, '0.0.0.0', () => {
    if (require.main === module) {
      console.log(`[GymCrush Sync Relay] Listening on http://0.0.0.0:${port}/__gymcrush_sync`);
    }
  });

  if (require.main !== module && typeof server.unref === 'function') {
    server.unref();
  }

  return server;
}

if (require.main === module) {
  const port = parseInt(process.env.GYMCRUSH_SYNC_PORT || '8787', 10);
  ensureStandaloneRelayServer(port);
}

module.exports = {
  handleSyncRequest,
  ensureStandaloneRelayServer,
  readRoomState,
  applyEnvelopeToRoom,
  createEmptyRoom,
  writeRoomState,
};
