import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
});

// Create a namespace for system operations
const systemNamespace = io.of("/system");
const defaultNamespace = io.of("/");

const users = new Map<string, Socket>();

// Socket.IO connection handling for the main namespace
defaultNamespace.on("connection", (socket) => {
  if (!socket.handshake.query.userId) {
    socket.emit("error", "User not authenticated");
    socket.disconnect();
    return;
  }

  if (users.has(socket.handshake.query.userId as string)) {
    socket.emit("error", "User already connected");
    socket.disconnect();
    return;
  }

  const userId = socket.handshake.query.userId as string;
  users.set(userId, socket);

  socket.on("disconnect", () => {
    users.delete(userId);
  });

  // Add your custom socket events here
  socket.on("message", (data) => {
    io.emit("message", data);
  });
});

// Socket.IO connection handling for the system namespace
systemNamespace.on("connection", (socket) => {
  if (!socket.handshake.query.userId) {
    socket.emit("error", "User not authenticated");
    socket.disconnect();
    return;
  }

  const userId = socket.handshake.query.userId as string;

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected from system namespace`);
  });

  // Handle clientside-call events
  socket.on("clientside-call", ({ functionName, args, callBack }) => {
    console.log(
      `User ${userId} called ${functionName} with args ${JSON.stringify(args)}`
    );
    users.get(userId)?.emit("clientside-call", {
      functionName,
      args,
      callBack: ({ status, result }: { status: boolean; result: any }) => {
        callBack({ status, result });
      },
    });
  });
});

const PORT = process.env.SOCKET_PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
