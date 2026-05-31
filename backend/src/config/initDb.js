const { connectDB, getClient } = require("./db");

async function initDb() {
  console.log("🚀 Initializing database...");
  const db = await connectDB();

  if (!db) {
    console.error("❌ Failed to connect to database for initialization.");
    process.exit(1);
  }

  try {
    // ─── Users Collection ─────────────────────────────────────────────────────
    console.log("Creating 'users' collection and unique email index...");
    await db.collection("users").createIndex({ email: 1 }, { unique: true });

    // ─── Projects Collection ──────────────────────────────────────────────────
    console.log("Creating 'projects' collection and indexes...");
    await db.collection("projects").createIndex({ user_id: 1 });

    // ─── Project Snapshots Collection ─────────────────────────────────────────
    console.log("Creating 'project_snapshots' collection and indexes...");
    await db.collection("project_snapshots").createIndex({ project_id: 1 });
    await db.collection("project_snapshots").createIndex({ snapshot_date: -1 });

    // ─── Recommendations Collection ───────────────────────────────────────────
    console.log("Creating 'recommendations' collection and indexes...");
    await db.collection("recommendations").createIndex({ project_id: 1 });
    await db.collection("recommendations").createIndex({ snapshot_id: 1 });

    // ─── Alerts Collection ─────────────────────────────────────────────────────
    console.log("Creating 'alerts' collection and indexes...");
    await db.collection("alerts").createIndex({ project_id: 1 });
    await db.collection("alerts").createIndex({ created_at: -1 });

    // ─── Jobs Collection ───────────────────────────────────────────────────────
    console.log("Creating 'jobs' collection and indexes...");
    await db.collection("jobs").createIndex({ project_id: 1 });
    await db.collection("jobs").createIndex({ status: 1 });

    // ─── AI Reports Collection ──────────────────────────────────────────────────
    console.log("Creating 'ai_reports' collection and indexes...");
    await db.collection("ai_reports").createIndex({ project_id: 1 });
    await db.collection("ai_reports").createIndex({ generated_at: -1 });
    await db.collection("ai_reports").createIndex({ status: 1 });

    // ─── File Analyses Collection ──────────────────────────────────────────────
    console.log("Creating 'file_analyses' collection and indexes...");
    await db.collection("file_analyses").createIndex({ project_id: 1, report_id: 1 });
    await db.collection("file_analyses").createIndex({ project_id: 1, file_path: 1 });

    // ─── Module Analyses Collection ────────────────────────────────────────────
    console.log("Creating 'module_analyses' collection and indexes...");
    await db.collection("module_analyses").createIndex({ project_id: 1, report_id: 1 });

    console.log("✅ Database initialization complete!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
  } finally {
    const client = getClient();
    if (client) {
      await client.close();
      console.log("📡 Database connection closed.");
    }
    process.exit(0);
  }
}

initDb();
