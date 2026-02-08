const express = require('express');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// In-memory data store
const rooms = new Map();

// Generate short room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.static('public'));

// REST endpoints
app.post('/api/rooms', (req, res) => {
  const { title, hostId, speakerWallet } = req.body;
  
  if (!title || !hostId || !speakerWallet) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const roomId = generateRoomId();
  const room = {
    id: roomId,
    hostId,
    title,
    speakerWallet,
    createdAt: Date.now(),
    participants: new Set(),
    currentSentiment: new Map(),
    sentimentLog: [],
    tips: [],
    totalTips: 0,
    clients: new Set()
  };

  rooms.set(roomId, room);

  // Start sentiment aggregation for this room
  const sentimentInterval = setInterval(() => {
    if (room.participants.size === 0) {
      clearInterval(sentimentInterval);
      return;
    }

    const sentiments = Array.from(room.currentSentiment.values());
    if (sentiments.length > 0) {
      const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      const snapshot = {
        ts: Date.now(),
        avg: Math.round(avg * 100) / 100,
        count: sentiments.length
      };
      
      room.sentimentLog.push(snapshot);
      
      // Broadcast to all clients
      const message = JSON.stringify({
        type: 'snapshot',
        ...snapshot
      });
      
      room.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }, 5000);

  res.json({ roomId });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    title: room.title,
    speakerWallet: room.speakerWallet,
    attendeeCount: room.participants.size,
    totalTips: room.totalTips
  });
});

// WebSocket handling
wss.on('connection', (ws) => {
  let currentRoom = null;
  let userRole = null;
  let alienId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join':
          const { roomId, alienId: msgAlienId, role } = message;
          const room = rooms.get(roomId);
          
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            ws.close();
            return;
          }

          // Sybil protection
          if (room.participants.has(msgAlienId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'User already in room' }));
            ws.close();
            return;
          }

          currentRoom = room;
          userRole = role;
          alienId = msgAlienId;
          
          room.participants.add(msgAlienId);
          room.clients.add(ws);
          
          // Send room info
          ws.send(JSON.stringify({
            type: 'room_info',
            title: room.title,
            speakerWallet: room.speakerWallet
          }));

          // Broadcast user count
          const countMsg = JSON.stringify({
            type: 'user_count',
            count: room.participants.size
          });
          
          room.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(countMsg);
            }
          });
          break;

        case 'sentiment':
          if (currentRoom && alienId) {
            currentRoom.currentSentiment.set(alienId, message.value);
          }
          break;

        case 'tip':
          if (currentRoom && alienId) {
            const tip = {
              from: alienId,
              amount: message.amount,
              txId: message.txId,
              ts: Date.now()
            };
            
            currentRoom.tips.push(tip);
            currentRoom.totalTips += message.amount;
            
            const tipMsg = JSON.stringify({
              type: 'tip_event',
              amount: message.amount,
              totalTips: currentRoom.totalTips,
              ts: tip.ts
            });
            
            currentRoom.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(tipMsg);
              }
            });
          }
          break;

        case 'leave':
          if (currentRoom && alienId) {
            currentRoom.participants.delete(alienId);
            currentRoom.currentSentiment.delete(alienId);
            currentRoom.clients.delete(ws);
            
            // Broadcast updated count
            const countMsg = JSON.stringify({
              type: 'user_count',
              count: currentRoom.participants.size
            });
            
            currentRoom.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(countMsg);
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoom && alienId) {
      currentRoom.participants.delete(alienId);
      currentRoom.currentSentiment.delete(alienId);
      currentRoom.clients.delete(ws);
      
      // Broadcast updated count
      const countMsg = JSON.stringify({
        type: 'user_count',
        count: currentRoom.participants.size
      });
      
      currentRoom.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(countMsg);
        }
      });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Pulse server running on http://${HOST}:${PORT}`);
});
