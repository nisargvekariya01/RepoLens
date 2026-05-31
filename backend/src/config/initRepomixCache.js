/**
 * initRepomixCache.js
 *
 * One-time migration script: creates the `repomix_cache` collection in MongoDB
 * with a TTL index on `expires_at` so stale cache entries are purged automatically.
 *
 * Run once:
 *   node src/config/initRepomixCache.js
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");

async function run() {
  const client = new MongoClient(process.env.MONGO_URL);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    // Create collection (safe to call even if it already exists)
    const collections = await db.listCollections({ name: "repomix_cache" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("repomix_cache");
      console.log("✅ Created collection: repomix_cache");
    } else {
      console.log("ℹ️  Collection repomix_cache already exists");
    }

    const col = db.collection("repomix_cache");

    // TTL index: MongoDB auto-deletes documents when expires_at has passed
    await col.createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 0, name: "repomix_cache_ttl" }
    );
    console.log("✅ TTL index on expires_at created (expireAfterSeconds: 0)");

    // Compound index for fast cache lookups by project + hash
    await col.createIndex(
      { project_id: 1, repo_hash: 1 },
      { unique: true, name: "repomix_cache_lookup" }
    );
    console.log("✅ Compound index on project_id + repo_hash created");

    console.log("\n🎉 repomix_cache collection is ready.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
