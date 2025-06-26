import express from "express";
import { WebSocketServer } from "ws";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer für Memory Uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
app.post("/uploadProfilePic", upload.single("image"), (req, res) => {
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).json({ error: "No file uploaded" });
  }

  cloudinary.uploader.upload_stream(
    { upload_preset: process.env.UPLOAD_PRESET },
    (error, result) => {
      if (error) {
        console.error("Cloudinary upload failed:", error);
        return res.status(500).json({ error: "Cloudinary upload failed" });
      }
      console.log("Cloudinary upload success:", result.secure_url);
      res.json({ url: result.secure_url });
    }
  ).end(req.file.buffer);
});
