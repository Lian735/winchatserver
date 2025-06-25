import express from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const server = app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

function broadcastOnline() {
  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online", count });
  console.log("Sending online update to all clients:", payload);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

wss.on("connection", ws => {
  console.log("New client connected");
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  broadcastOnline();

  // Send current online count to just this new client
  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online", count });
  ws.send(payload);

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

// Heartbeat Check - alle 30 Sekunden
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log("Terminating dead client");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

// Cloudinary Signature Endpoint
app.get("/getCloudinarySignature", (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `timestamp=${timestamp}&upload_preset=${process.env.UPLOAD_PRESET}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + process.env.CLOUDINARY_API_SECRET)
    .digest("hex");

  res.json({
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.UPLOAD_PRESET
  });
});
