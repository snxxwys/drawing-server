const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map(); // roomId -> Set<ws>

// Keepalive ping every 30s to prevent Render from closing idle connections
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    for (const ws of room) {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        room.delete(ws);
      }
    }
    if (room.size === 0) rooms.delete(roomId);
  }
}, 30000);

wss.on("connection", (ws, req) => {
  const params = new URL(req.url, "http://x").searchParams;
  const roomId = params.get("room") || "default";

  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const room = rooms.get(roomId);
  room.add(ws);

  console.log(`[${roomId}] connected — ${room.size} in room`);

  ws.on("pong", () => {}); // keepalive response

  ws.on("message", (data) => {
    for (const peer of room) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        peer.send(data);
      }
    }
  });

  ws.on("close", () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(roomId);
    console.log(`[${roomId}] disconnected — ${room.size} in room`);
  });

  ws.on("error", console.error);
});

console.log(`Server on port ${PORT}`);
