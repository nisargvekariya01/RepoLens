const { getDb } = require("../config/db");

const submitFeedback = async (req, res) => {
  try {
    const { type, message, email, user_id } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: "Type and message are required" });
    }

    const db = getDb();
    const feedbackCollection = db.collection("feedback");

    const feedback = {
      type,
      message,
      email: email || null,
      user_id: user_id || null,
      status: "new",
      created_at: new Date(),
    };

    const result = await feedbackCollection.insertOne(feedback);

    res.status(201).json({ 
      message: "Feedback submitted successfully", 
      id: result.insertedId 
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
};

module.exports = {
  submitFeedback,
};
