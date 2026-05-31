const axios = require('axios');

let lastCallTime = 0;

/**
 * Call the Gemini REST API using plain Axios.
 * Implements a simple in-memory 5-second rate limiter (max 15 RPM).
 * 
 * @param {string} prompt 
 * @param {number} maxOutputTokens 
 * @returns {any|string|null} Parsed JSON, raw string, or null on error
 */
async function callGemini(prompt, maxOutputTokens = 2048) {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing in environment variables. Call to Gemini ignored.");
    return null;
  }

  // Basic in-memory Rate Limiting (max 1 call per 5 seconds)
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < 5000) {
    const delay = 5000 - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastCallTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens,
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" }
    });
    
    let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        return null;
    }
    
    // Attempt to parse JSON. Since responseMimeType is set to application/json, 
    // Gemini may wrap the response in markdown like ```json ... ```
    try {
      if (text.startsWith("```")) {
        text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
      }
      return JSON.parse(text.trim());
    } catch (parseError) {
      // Fallback: return raw string
      return text;
    }
  } catch (error) {
    console.error("Gemini API HTTP Error:", error.response?.data || error.message);
    return null; // Ensure we never throw
  }
}

module.exports = { callGemini };
