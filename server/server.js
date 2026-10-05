const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Enable CORS for Netlify and mobile apps
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Állati Aréna (Animal Clash)',
    activeRooms: Object.keys(rooms).length,
    connectedSockets: wss.clients.size,
    timestamp: Date.now()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Állati Aréna - Multiplayer Game Server</title></head>
      <body style="font-family: sans-serif; background: #2c1a0e; color: #fff; text-align: center; padding: 50px;">
        <h1 style="color: #ffc93c;">🐾 Állati Aréna Multiplayer Server</h1>
        <p style="color: #2ed573; font-weight: bold; font-size: 18px;">● Status: Online & Active</p>
        <p>Active 4-digit Rooms: <b>${Object.keys(rooms).length}</b></p>
        <p>Connected Players: <b>${wss.clients.size}</b></p>
        <p style="color: #ccc; font-size: 13px;">WebSocket Endpoint: ws:// or wss://[your-domain]</p>
      </body>
    </html>
  `);
});

// Multiplayer room storage
// roomCode -> { code, host: ws, guest: ws, hostDeck, guestDeck, state, createdAt }
const rooms = {};

function generateRoomCode() {
  let code;
  let attempts = 0;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  } while (rooms[code] && attempts < 100);
  return code;
}

function cleanExpiredRooms() {
  const now = Date.now();
  for (const code in rooms) {
    if (now - rooms[code].createdAt > 30 * 60 * 1000) { // 30 mins
      delete rooms[code];
    }
  }
}
setInterval(cleanExpiredRooms, 60 * 1000);

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.isHost = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (err) {
      console.error('Error parsing WS message:', err);
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms[ws.roomCode]) {
      const room = rooms[ws.roomCode];
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'opponent_disconnected',
          message: 'Your opponent left or disconnected.'
        }));
      }
      delete rooms[ws.roomCode];
    }
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'create_room': {
      cleanExpiredRooms();
      const code = generateRoomCode();
      rooms[code] = {
        code,
        host: ws,
        guest: null,
        hostDeck: data.deck || [],
        hostName: data.name || 'Player 1',
        guestDeck: null,
        guestName: null,
        arena: data.arena || 1,
        state: 'waiting',
        createdAt: Date.now()
      };
      ws.roomCode = code;
      ws.isHost = true;

      ws.send(JSON.stringify({
        type: 'room_created',
        code,
        role: 'host'
      }));
      console.log(`[Room Created] ${code} by ${data.name || 'Player 1'}`);
      break;
    }

    case 'join_room': {
      const code = String(data.code).trim();
      const room = rooms[code];
      if (!room) {
        ws.send(JSON.stringify({
          type: 'join_error',
          message: `Szoba "${code}" nem található! Ellenőrizd a kódot.`
        }));
        return;
      }
      if (room.guest) {
        ws.send(JSON.stringify({
          type: 'join_error',
          message: `A "${code}" szoba már megtelt.`
        }));
        return;
      }

      room.guest = ws;
      room.guestDeck = data.deck || [];
      room.guestName = data.name || 'Player 2';
      room.state = 'playing';
      ws.roomCode = code;
      ws.isHost = false;

      // Notify host
      if (room.host.readyState === WebSocket.OPEN) {
        room.host.send(JSON.stringify({
          type: 'match_start',
          code,
          role: 'host',
          opponentName: room.guestName,
          opponentDeck: room.guestDeck,
          arena: room.arena
        }));
      }

      // Notify guest
      ws.send(JSON.stringify({
        type: 'match_start',
        code,
        role: 'guest',
        opponentName: room.hostName,
        opponentDeck: room.hostDeck,
        arena: room.arena
      }));

      console.log(`[Match Started] Room ${code}: ${room.hostName} vs ${room.guestName}`);
      break;
    }

    case 'deploy_card': {
      if (!ws.roomCode || !rooms[ws.roomCode]) return;
      const room = rooms[ws.roomCode];
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'opponent_deploy',
          cardId: data.cardId,
          x: data.x,
          y: data.y,
          level: data.level || 1,
          timestamp: data.timestamp
        }));
      }
      break;
    }

    case 'emote': {
      if (!ws.roomCode || !rooms[ws.roomCode]) return;
      const room = rooms[ws.roomCode];
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'opponent_emote',
          emote: data.emote
        }));
      }
      break;
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Állati Aréna Multiplayer Server running on port ${PORT}`);
});
