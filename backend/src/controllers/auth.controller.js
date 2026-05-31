const bcrypt = require("bcryptjs");
const { getDb } = require("../config/db");
const admin = require("../config/firebase-admin");

/**
 * Legacy Soft-Migration endpoint.
 * Validates old password hash, builds user in Firebase natively, and upgrades them gracefully.
 */
async function migrateLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required for migration." });
  }

  try {
    const db = getDb();
    const usersCollection = db.collection("users");

    // 1. Validate legacy hash
    const user = await usersCollection.findOne({ email });
    if (!user || user.is_migrated) {
      return res.status(400).json({ error: "User not found or already migrated." });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: "This account has no legacy password." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid legacy credentials." });
    }

    // 2. Create in Firebase synchronously
    try {
      const firebaseUser = await admin.auth().createUser({
        email,
        password, // Replaces hash natively
        emailVerified: true
      });

      // 3. Flag transition & map UID
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { firebase_uid: firebaseUser.uid, is_migrated: true },
          $unset: { password_hash: "" } // Destroy bcrypt securely
        }
      );

      // 4. Dispatch a custom Token to authorize the frontend immediately
      const customToken = await admin.auth().createCustomToken(firebaseUser.uid);
      
      return res.status(200).json({ customToken, message: "Migration successful!" });

    } catch (fbError) {
      if (fbError.code === 'auth/email-already-exists') {
        // They might have signed up via Google with same email before migrating explicitly.
        const existingFbUser = await admin.auth().getUserByEmail(email);
        
        await usersCollection.updateOne(
          { _id: user._id },
          { 
            $set: { firebase_uid: existingFbUser.uid, is_migrated: true },
            $unset: { password_hash: "" }
          }
        );
        const customToken = await admin.auth().createCustomToken(existingFbUser.uid);
        return res.status(200).json({ customToken, message: "Migration reconciled successfully!" });
      }
      throw fbError;
    }

  } catch (error) {
    console.error("Migration error:", error.message);
    res.status(500).json({ error: "Internal server error during migration." });
  }
}

/**
 * Get current user info (protected).
 */
async function me(req, res) {
  // Provided through auth middleware which verifies the Firebase ID token.
  res.status(200).json({ user: req.user });
}

/**
 * Optional RBAC Assignment.
 * Grants a custom claim (e.g. 'admin') mapped directly to their Firebase JWT payload.
 */
async function assignRole(req, res) {
  const { targetEmail, role } = req.body;
  if (!req.user || req.user.role !== 'admin') {
     return res.status(403).json({ error: "Unauthorized to delegate hierarchy." })
  }

  try {
    const user = await admin.auth().getUserByEmail(targetEmail);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    res.status(200).json({ message: `Role '${role}' assigned to ${targetEmail}` });
  } catch (error) {
    console.error("RBAC Assignment error", error.message);
    res.status(400).json({ error: "Could not apply role securely." });
  }
}

module.exports = {
  migrateLogin,
  me,
  assignRole
};
