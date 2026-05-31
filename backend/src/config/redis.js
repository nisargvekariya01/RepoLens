const Redis = require("ioredis");
require("dotenv").config();

const redisUrl = process.env.REDIS_URL;

const connection = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    })
  : null;

if (connection) {
  connection.on("connect", () => {
    console.log("✅ Redis connected successfully");
  });

  connection.on("error", (err) => {
    console.error("❌ Redis connection error:", err.message);
  });
}

module.exports = connection;
