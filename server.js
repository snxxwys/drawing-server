const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Track connected clients by room
// Two roles per room: "app" (your phone) and "display" (ESP32 or second browser)
const rooms = {};

function getRoom(roomId) {
  if (!rooms[roomId]) rooms[roomId] = { app: null, display: null };
  return rooms[roomId];
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const roomId = url.searchParams.get("room") || "default";
  const role = url.searchParams.get("role"); // "app" or "display"

  if (!role || !["app", "display"].includes(role)) {
    ws.close(1008, "Missing or invalid role param (?role=app or ?role=display)");
    return;
  }

  const room = getRoom(roomId);

  // Close existing connection for this role if any
  if (room[role] && room[role].readyState === 1) {
    room[role].close(1000, "Replaced by new connection");
  }
  room[role] = ws;

  console.log(`[${roomId}] ${role} connected`);

  ws.on("message", (data) => {
    // Relay to the other role in the same room
    const other = role === "app" ? room.display : room.app;
    if (other && other.readyState === 1) {
      other.send(data);
    }
  });

  ws.on("close", () => {
    console.log(`[${roomId}] ${role} disconnected`);
    if (room[role] === ws) room[role] = null;
    // Clean up empty rooms
    if (!room.app && !room.display) delete rooms[roomId];
  });

  ws.on("error", (err) => {
    console.error(`[${roomId}] ${role} error:`, err.message);
  });

  // Confirm connection
  ws.send(JSON.stringify({ type: "connected", role, roomId }));
});

console.log(`Drawing relay server running on port ${PORT}`);
