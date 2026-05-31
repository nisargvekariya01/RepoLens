const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const { connectDB, getDb } = require("./config/db");

const app = express();
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const syncRoutes = require("./routes/sync.routes");
const aiAnalysisRoutes = require("./routes/aiAnalysis.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const githubRoutes = require("./routes/github.routes");
const githubOAuthRoutes = require("./routes/githubOAuth.routes");
const feedbackRoutes = require("./routes/feedback.routes");

// ─── Security & Logging Middleware ───────────────────────────────────────────
app.use(helmet());

// Rate limiter removed per user request

// Allow requests from the Vite dev server (and prod frontend)
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000",
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(morgan("dev"));


// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";
  try {
    const db = await connectDB();
    if (db) {
      await db.command({ ping: 1 });
      dbStatus = "connected";
    }
  } catch (error) {
    dbStatus = "error";
    console.error("Health check DB ping failed:", error.message);
  }

  res.status(200).json({
    status: "ok",
    db: dbStatus,
    timestamp: new Date(),
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", syncRoutes);
app.use("/api/projects", aiAnalysisRoutes);
app.use("/api/projects", dashboardRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/github", githubOAuthRoutes);
app.use("/api/feedback", feedbackRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

module.exports = app;
