import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const port = process.env.PORT || 8080;

const server = app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("New client connected");

  ws.on("message", data => {
    console.log("Message received:", data.toString());

    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
