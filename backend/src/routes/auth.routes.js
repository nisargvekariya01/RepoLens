const express = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @route POST /api/auth/migrate-login
 * @desc Soft-Migration for Legacy credentials -> Firebase
 */
router.post("/migrate-login", authController.migrateLogin);

/**
 * @route GET /api/auth/me
 * @desc Auto-sync Firebase User & Return details (via middleware payload extraction)
 * @access Protected
 */
router.get("/me", authMiddleware, authController.me);

/**
 * @route POST /api/auth/assign-role
 * @desc Attach a Custom Security Claim payload to a Firebase JWT
 * @access Protected (Admin only)
 */
router.post("/assign-role", authMiddleware, authController.assignRole);

module.exports = router;
