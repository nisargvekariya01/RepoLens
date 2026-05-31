const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");

const MAX_REPOS_BASIC = 3;
const MAX_ANALYSES_BASIC = 5;
const MAX_RAG_QUERIES_BASIC = 5;

/**
 * Helper to check if a user is unlimited.
 */
async function isUnlimitedUser(userId) {
  const db = getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
  return user?.plan === "pro";
}

/**
 * Checks if a user can add another repository.
 * Throws an Error with statusCode 403 if limit is exceeded.
 */
async function checkRepoLimit(userId) {
  if (await isUnlimitedUser(userId)) {
    return; // Unlimited access
  }

  const db = getDb();
  const projectCount = await db.collection("projects").countDocuments({
    user_id: new ObjectId(userId)
  });

  if (projectCount >= MAX_REPOS_BASIC) {
    const error = new Error(`Subscription Limit: You can only have up to ${MAX_REPOS_BASIC} repositories on the Basic plan. Upgrade to Pro for unlimited repositories.`);
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Checks if a user can trigger another analysis/sync today, and increments their count if so.
 * Throws an Error with statusCode 429 if limit is exceeded.
 */
async function checkAndIncrementAnalysisLimit(userId) {
  const db = getDb();
  const userObjectId = new ObjectId(userId);
  
  const user = await db.collection("users").findOne({ _id: userObjectId });
  if (!user) {
    throw new Error("User not found.");
  }

  if (user.plan === "pro") {
    return; // Unlimited access
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dailyUsage = user.daily_analyses || { count: 0, date: "" };

  if (dailyUsage.date === today && dailyUsage.count >= MAX_ANALYSES_BASIC) {
    const error = new Error(`Subscription Limit: You have reached your limit of ${MAX_ANALYSES_BASIC} analyses today on the Basic plan. Upgrade to Pro for unlimited analyses.`);
    error.statusCode = 429;
    throw error;
  }

  // Update logic: reset count if new day, otherwise increment
  const newCount = dailyUsage.date === today ? dailyUsage.count + 1 : 1;

  await db.collection("users").updateOne(
    { _id: userObjectId },
    {
      $set: {
        "daily_analyses.count": newCount,
        "daily_analyses.date": today,
      }
    }
  );
}

/**
 * Checks if a user can perform another RAG query today, and increments their count if so.
 * Throws an Error with statusCode 429 if limit is exceeded.
 */
async function checkAndIncrementRagLimit(userId) {
  const db = getDb();
  const userObjectId = new ObjectId(userId);
  
  const user = await db.collection("users").findOne({ _id: userObjectId });
  if (!user) {
    throw new Error("User not found.");
  }

  if (user.plan === "pro") {
    return; // Unlimited access
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dailyRag = user.daily_rag_queries || { count: 0, date: "" };

  if (dailyRag.date === today && dailyRag.count >= MAX_RAG_QUERIES_BASIC) {
    const error = new Error(`Subscription Limit: You have reached your limit of ${MAX_RAG_QUERIES_BASIC} AI Copilot queries today on the Basic plan. Upgrade to Pro for unlimited queries.`);
    error.statusCode = 429;
    throw error;
  }

  const newCount = dailyRag.date === today ? dailyRag.count + 1 : 1;

  await db.collection("users").updateOne(
    { _id: userObjectId },
    {
      $set: {
        "daily_rag_queries.count": newCount,
        "daily_rag_queries.date": today,
      }
    }
  );
}

module.exports = {
  checkRepoLimit,
  checkAndIncrementAnalysisLimit,
  checkAndIncrementRagLimit
};
