const admin = require("../config/firebase-admin");
const { getDb } = require("../config/db");

/**
 * Authentication middleware that verifies the Bearer token in the Authorization header via Firebase Auth.
 * Automatically synchronizes Firebase Users to the local MongoDB on the fly (JIT).
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No Firebase token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verify with Firebase
    const decoded = await admin.auth().verifyIdToken(token);
    
    // 2. Just-In-Time DB Sync (Ensure user has a MongoDB counterpart)
    const db = getDb();
    const usersCollection = db.collection("users");
    
    let user = await usersCollection.findOne({ firebase_uid: decoded.uid });

    if (!user) {
      // Legacy check: did they skip migration? (Shouldn't happen on normal frontend flow, but just in case)
      user = await usersCollection.findOne({ email: decoded.email });
      if (user) {
        // Automatically link them if they share the email but didn't have firebase_uid
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { firebase_uid: decoded.uid, is_migrated: true }, $unset: { password_hash: "" } }
        );
      } else {
        // Completely new user (e.g. Google OAuth or fresh registration)
        const newUser = {
          email: decoded.email,
          firebase_uid: decoded.uid,
          plan: "basic",
          created_at: new Date(),
          is_migrated: true // It was created organically in Firebase
        };
        const result = await usersCollection.insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
      }
    }

    // 3. Attach unified context payload
    req.user = { 
      id: user._id, 
      email: decoded.email, 
      firebase_uid: decoded.uid,
      role: decoded.role || 'user', // RBAC Custom Claim
      plan: user.plan || 'basic'
    };
    
    next();
  } catch (error) {
    console.error("Firebase JWT verification error:", error.message);
    res.status(401).json({ error: "Invalid or expired Firebase token." });
  }
}

module.exports = authMiddleware;
