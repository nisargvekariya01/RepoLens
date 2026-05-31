/**
 * tokenEncryption.js
 *
 * AES-256-GCM symmetric encryption for GitHub PAT/OAuth tokens.
 * Key must be 32 bytes (256 bits) — read from TOKEN_ENCRYPTION_KEY env var.
 *
 * Why GCM? Provides authenticated encryption (AEAD) — any tampering of the
 * ciphertext is detected, preventing token forgery/manipulation attacks.
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // GCM standard IV = 96 bits
const TAG_LENGTH = 16;  // GCM authentication tag = 128 bits

/**
 * Derive a 32-byte key from the env variable.
 * Accepts any string and SHA-256 hashes it to a stable 32-byte key.
 * This allows human-readable env values without strict length requirement.
 */
function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("[tokenEncryption] TOKEN_ENCRYPTION_KEY is not set in environment variables.");
  }
  // Always produces exactly 32 bytes regardless of input length
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a plaintext token string.
 * Output format: iv(hex):tag(hex):ciphertext(hex)
 *
 * @param {string} plaintext
 * @returns {string} encrypted token string safe for MongoDB storage
 */
function encryptToken(plaintext) {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("[tokenEncryption] encryptToken requires a non-empty string.");
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Store as colon-delimited hex segments — easy to split, no special chars
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an encrypted token string back to plaintext.
 *
 * @param {string} encryptedToken - Output of encryptToken()
 * @returns {string} plaintext token
 */
function decryptToken(encryptedToken) {
  if (!encryptedToken || typeof encryptedToken !== "string") {
    throw new Error("[tokenEncryption] decryptToken requires a non-empty string.");
  }

  const parts = encryptedToken.split(":");
  if (parts.length !== 3) {
    throw new Error("[tokenEncryption] Invalid encrypted token format.");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Safely decrypt a token, returning null on failure.
 * Use this in workers/services where a bad token should fail gracefully.
 *
 * @param {string|null} encryptedToken
 * @returns {string|null}
 */
function safeDecryptToken(encryptedToken) {
  if (!encryptedToken) return null;
  try {
    return decryptToken(encryptedToken);
  } catch (err) {
    console.warn("[tokenEncryption] safeDecryptToken failed:", err.message);
    return null;
  }
}

/**
 * Extract last 4 characters of plaintext token for display.
 * Never expose the full token to frontend.
 *
 * @param {string} plaintext
 * @returns {string} e.g. "a3f9"
 */
function getTokenLast4(plaintext) {
  if (!plaintext || plaintext.length < 4) return "****";
  return plaintext.slice(-4);
}

module.exports = {
  encryptToken,
  decryptToken,
  safeDecryptToken,
  getTokenLast4,
};
