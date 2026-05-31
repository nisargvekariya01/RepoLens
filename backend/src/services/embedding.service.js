const { pipeline, env } = require('@xenova/transformers');

// Prevent loading cached/local models unless they exist in cacheDir
env.cacheDir = './.cache/transformers';

let embedder = null;
let embedderPromise = null;

async function getEmbedder() {
  if (process.env.EMBEDDING_PROVIDER !== "local") {
    throw new Error("[Architecture Warning] System is enforcing exclusively local NLP embeddings. Set EMBEDDING_PROVIDER=\"local\" to bypass this error and disable external dependency mapping.");
  }

  if (embedder) return embedder;
  if (!embedderPromise) {
    console.log("[Embeddings] Downloading/Initializing local Xenova/all-MiniLM-L6-v2 model...");
    // Force quantized caching to be fast, but feature-extraction inherently defaults to quantized models.
    embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  
  embedder = await embedderPromise;
  console.log("[Embeddings] Local feature extraction model loaded fully into memory.");
  return embedder;
}

/**
 * Generates an embedding array purely locally 
 * using Xenova/all-MiniLM-L6-v2, mapping to 384 dimensions.
 * @param {string} text 
 * @returns {Array<number> | null}
 */
async function generateEmbedding(text) {
  try {
    const extractor = await getEmbedder();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    
    // Xenova outputs native Float32Array; Qdrant JS payload demands a standard JS Array.
    return Array.from(output.data);
  } catch (err) {
    console.error("[Embeddings] Local embedding generation failed:", err.message);
    return null;
  }
}

getEmbedder().catch(err => console.error("[Embeddings] Pre-load instantiation failed:", err));

module.exports = { generateEmbedding };
