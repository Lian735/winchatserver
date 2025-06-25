import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const port = process.env.PORT || 8080;

const server = app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

function broadcastOnline() {
  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online", count });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

wss.on("connection", ws => {
  console.log("New client connected");
  broadcastOnline();

  ws.on("message", data => {
    console.log("Message received:", data.toString());

    // Broadcast the message to all clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    broadcastOnline();
  });
});
