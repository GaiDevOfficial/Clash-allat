const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Animal Clash',
    activeRooms: Object.keys(rooms).length,
    connectedSockets: wss.clients.size,
    timestamp: Date.now()
  });
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
    if (now - rooms[code].createdAt > 30 * 60 * 1000) { // 30 minutes
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
      console.log(`Room created: ${code} by ${data.name || 'Player 1'}`);
      break;
    }

    case 'join_room': {
      const code = String(data.code).trim();
      const room = rooms[code];
      if (!room) {
        ws.send(JSON.stringify({
          type: 'join_error',
          message: `Room "${code}" not found. Check the code and try again!`
        }));
        return;
      }
      if (room.guest) {
        ws.send(JSON.stringify({
          type: 'join_error',
          message: `Room "${code}" is already full.`
        }));
        return;
      }

      room.guest = ws;
      room.guestDeck = data.deck || [];
      room.guestName = data.name || 'Player 2';
      room.state = 'playing';
      ws.roomCode = code;
      ws.isHost = false;

      // Notify guest they joined
      ws.send(JSON.stringify({
        type: 'room_joined',
        code,
        role: 'guest',
        opponentName: room.hostName,
        opponentDeck: room.hostDeck,
        arena: room.arena
      }));

      // Notify host that guest connected & start match
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

      // Also send match_start to guest
      ws.send(JSON.stringify({
        type: 'match_start',
        code,
        role: 'guest',
        opponentName: room.hostName,
        opponentDeck: room.hostDeck,
        arena: room.arena
      }));

      console.log(`Player joined room ${code}: ${room.guestName} vs ${room.hostName}`);
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

    case 'sync_state': {
      if (!ws.roomCode || !rooms[ws.roomCode]) return;
      const room = rooms[ws.roomCode];
      // Only host sends authoritative sync or each forwards their tower damage/elixir
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'state_sync',
          fromHost: ws.isHost,
          towers: data.towers,
          time: data.time,
          crowns: data.crowns
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

    case 'surrender': {
      if (!ws.roomCode || !rooms[ws.roomCode]) return;
      const room = rooms[ws.roomCode];
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({
          type: 'opponent_surrendered'
        }));
      }
      delete rooms[ws.roomCode];
      break;
    }
  }
}

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Animal Clash Server running on port ${PORT}`);
  console.log(` http://localhost:${PORT}`);
  console.log(`=========================================`);
});
