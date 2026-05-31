require("dotenv").config();

const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
require("./services/embedding.service"); // Initialize Local NLP Vector Module
const { Server } = require("socket.io");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

global.io = io;

io.on("connection", (socket) => {
  console.log(`🟢 New client connected: ${socket.id}`);
  
  socket.on("join-job", (jobId) => {
    if (jobId) {
      const room = jobId.toString();
      socket.join(room);
      console.log(`🔌 Socket ${socket.id} joined room: ${room}`);
    }
  });

  // Subscribe to project-level events (e.g. ai:completed)
  socket.on("join-project", (projectId) => {
    if (projectId) {
      const room = projectId.toString();
      socket.join(room);
      console.log(`🔌 Socket ${socket.id} joined project room: ${room}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// Initialize background workers
require("./jobs/projectSync.worker");
require("./jobs/aiAnalysis.worker");

const { resumeIncompleteJobs } = require("./jobs/aiAnalysis.queue");

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/health`);
    
    // Resume any jobs that were stuck (e.g. server crash during analysis)
    resumeIncompleteJobs();
  });
});
