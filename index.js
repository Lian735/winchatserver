import express from "express";
import { WebSocketServer } from "ws";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

// .env Variablen laden
dotenv.config();

// Cloudinary Konfiguration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const port = process.env.PORT || 8080;
const upload = multer({ dest: "uploads/" });

// WebSocket Server
const server = app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

function broadcastOnline() {
  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online", count });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

wss.on("connection", (ws) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  broadcastOnline();

  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online", count });
  ws.send(payload);

  ws.on("message", (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });

  ws.on("close", () => {
    broadcastOnline();
  });
});

// Heartbeat für tote Clients
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

// Cloudinary Upload Endpoint
app.post("/uploadProfilePic", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "profile_pics",
      upload_preset: process.env.UPLOAD_PRESET,
    });

    fs.unlink(req.file.path, () => {}); // Temp-Datei löschen
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Cloudinary upload failed" });
  }
});
