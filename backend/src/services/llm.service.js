const OpenAI = require("openai");

// ─── INITIALIZATION ────────────────────────────────────────────────────────────

const llmClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
});

const DEFAULT_MODEL = process.env.LLM_MODEL || "llama-3.1-8b-instant";

// Groq hard limit: 6000 TPM. We stay well below with a conservative ceiling.
const GROQ_SAFE_INPUT_TOKEN_LIMIT = 4800;

// ─── QUEUE SYSTEM ──────────────────────────────────────────────────────────────

class SequentialQueue {
  constructor(delayMs = 2000) {
    this.queue = [];
    this.isProcessing = false;
    this.delayMs = delayMs;
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const { task, resolve, reject } = this.queue.shift();
    try {
      console.log(`[LLM Queue] Processing job. Queue length: ${this.queue.length}`);
      const result = await task();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      await new Promise(r => setTimeout(r, this.delayMs));
      this.isProcessing = false;
      this.processNext();
    }
  }
}

const llmQueue = new SequentialQueue(150);

// ─── TOKEN ESTIMATION ──────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token. */
function estimatePromptTokens(prompt) {
  return Math.ceil(prompt.length / 4);
}

// ─── PROMPT GUARD ─────────────────────────────────────────────────────────────

/**
 * Hard-truncate a prompt to stay under the Groq safe token limit.
 * Removes characters from the middle of the CODE CONTEXT block to preserve
 * the system instructions and JSON schema at top/bottom.
 */
function guardPromptSize(prompt, maxTokens) {
  const estimated = estimatePromptTokens(prompt);
  const maxChars  = GROQ_SAFE_INPUT_TOKEN_LIMIT * 4;

  console.log(`[LLM] Estimated prompt tokens: ~${estimated}`);

  if (prompt.length <= maxChars) return prompt;

  console.warn(`[LLM] Prompt too large (${prompt.length} chars / ~${estimated} tokens) — truncating context block`);

  // Find CODE CONTEXT block and truncate it
  const ctxStart = prompt.indexOf("═══ CODE CONTEXT ═══");
  const ctxEnd   = prompt.indexOf("═══ ANALYSIS TASK ═══");

  if (ctxStart !== -1 && ctxEnd !== -1 && ctxEnd > ctxStart) {
    const before  = prompt.slice(0, ctxStart + 25);          // header up to and including marker
    const after   = prompt.slice(ctxEnd);                    // task block preserved
    const budget  = maxChars - before.length - after.length - 50;
    const context = prompt.slice(ctxStart + 25, ctxEnd);
    const trimmed = budget > 200 ? context.slice(0, budget) + "\n...[CONTEXT TRUNCATED]\n" : "";
    const guarded = before + trimmed + after;
    console.log(`[LLM] Prompt trimmed: ${prompt.length} → ${guarded.length} chars`);
    return guarded;
  }

  // Fallback: blunt suffix truncation
  const guarded = prompt.slice(0, maxChars) + "\n...[PROMPT TRUNCATED]";
  console.log(`[LLM] Prompt blunt-trimmed: ${prompt.length} → ${guarded.length} chars`);
  return guarded;
}

// ─── CHAT / GENERATION ─────────────────────────────────────────────────────────

async function executeChatCall(prompt, maxTokens, expectJson) {
  const safePrompt = guardPromptSize(prompt, maxTokens);

  const params = {
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: safePrompt }],
    temperature: 0.1,
    max_tokens: maxTokens,
  };

  if (expectJson) {
    params.response_format = { type: "json_object" };
  }

  const response = await llmClient.chat.completions.create(params);
  let text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from Groq");

  if (expectJson) {
    if (text.startsWith("```")) {
      text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    }
    try {
      return JSON.parse(text.trim());
    } catch (e) {
      console.warn("[LLM] Output was not strictly JSON, returning raw string.");
      return text;
    }
  }
  return text;
}

// ─── RETRY WITH 413 FALLBACK ──────────────────────────────────────────────────

/**
 * Retry loop:
 *  - attempt 1-2: normal call
 *  - on 413 (too large): aggressively shrink prompt + reduce max_tokens → retry
 *  - on 429: back off 10s
 */
async function attemptLLMWithRetry(prompt, maxTokens, expectJson) {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // On 413 retry: slash the prompt length and output budget in half
    const attemptPrompt    = attempt >= 2 ? prompt.slice(0, Math.floor(prompt.length * 0.55)) + "\n...[CONTEXT COMPRESSED FOR RETRY]" : prompt;
    const attemptMaxTokens = attempt >= 2 ? Math.min(maxTokens, 500) : maxTokens;

    if (attempt > 1) {
      console.warn(`[LLM] Retrying with compressed context (attempt ${attempt}). Prompt: ${attemptPrompt.length} chars, max_tokens: ${attemptMaxTokens}`);
    }

    try {
      return await executeChatCall(attemptPrompt, attemptMaxTokens, expectJson);
    } catch (error) {
      const is429 = error.status === 429 || String(error.message).includes("429");
      const is413 = error.status === 413 || String(error.message).includes("413") || String(error.message).toLowerCase().includes("too large");

      if (is413 && attempt < MAX_ATTEMPTS) {
        console.warn(`[LLM] Groq 413 — prompt too large. Retrying with compressed context...`);
        continue;
      } else if (is429 && attempt < MAX_ATTEMPTS) {
        console.warn(`[LLM] Groq 429 rate-limit on attempt ${attempt}. Waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        console.error(`[LLM] Groq call failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${error.message}`);
        throw error;
      }
    }
  }
  return null;
}

/**
 * Public API: enqueue an LLM call through the sequential rate-limit queue.
 */
async function callLLM(prompt, maxTokens = 700, expectJson = true) {
  return llmQueue.enqueue(() => attemptLLMWithRetry(prompt, maxTokens, expectJson));
}

module.exports = { callLLM, estimatePromptTokens };
