const { MongoClient } = require("mongodb");
require("dotenv").config();

const url = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || "repolens";

let client;
let db;

/**
 * Connects to MongoDB and initializes the database instance.
 */
async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(url);
    await client.connect();
    console.log("✅ MongoDB connected successfully");

    db = client.db(dbName);
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    // Do not exit process here to allow the app to handle it gracefully
    return null;
  }
}

/**
 * Returns the database instance.
 */
function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db;
}

/**
 * Returns the raw MongoClient instance.
 */
function getClient() {
  return client;
}

module.exports = {
  connectDB,
  getDb,
  getClient,
};
