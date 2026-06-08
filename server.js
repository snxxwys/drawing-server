const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

// Ping all clients every 30s to keep Render from closing idle connections
const PING_INTERVAL = 30000;

setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    for (const client of room) {
      if (client.readyState === 1) {
        client.ping();
      } else {
        room.delete(client);
      }
    }
    if (room.size === 0) rooms.delete(roomId);
  }
}, PING_INTERVAL);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const roomId = url.searchParams.get("room") || "default";

  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const room = rooms.get(roomId);
  room.add(ws);

  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  console.log(`[${roomId}] client connected (${room.size} in room)`);

  ws.on("message", (data) => {
    for (const client of room) {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => {
    room.delete(ws);
    console.log(`[${roomId}] client disconnected (${room.size} in room)`);
    if (room.size === 0) rooms.delete(roomId);
  });

  ws.on("error", (err) => {
    console.error(`[${roomId}] error:`, err.message);
  });

  ws.send(JSON.stringify({ type: "connected", roomId }));
});

console.log(`Drawing relay server running on port ${PORT}`);
