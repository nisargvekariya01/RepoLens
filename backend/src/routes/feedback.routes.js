const express = require("express");
const { submitFeedback } = require("../controllers/feedback.controller");

const router = express.Router();

// POST /api/feedback
router.post("/", submitFeedback);

module.exports = router;
