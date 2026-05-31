const { QdrantClient } = require("@qdrant/js-client-rest");

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY || undefined
});

// Xenova/all-MiniLM-L6-v2 produces 384-dimensional vectors
const CONST_VECTOR_SIZE = 384;

/**
 * Ensures the codebase collection is initialized and has the correct dimensions.
 * Will recreate the collection if dimensions mismatch.
 */
async function initCollection(collectionName = "codebase_index") {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (exists) {
      const collectionInfo = await qdrant.getCollection(collectionName);
      const existingSize = collectionInfo.config.params.vectors.size;

      if (existingSize !== CONST_VECTOR_SIZE) {
        console.warn(`[Qdrant] Dimension mismatch detected! Existing: ${existingSize}, Required: ${CONST_VECTOR_SIZE}. Recreating collection...`);
        await qdrant.deleteCollection(collectionName);
        console.log(`[Qdrant] Deleted old collection '${collectionName}'.`);
      } else {
        const existingSchema = collectionInfo.payload_schema || {};
        await ensurePayloadIndices(collectionName, existingSchema);
        return;
      }
    }

    await qdrant.createCollection(collectionName, {
      vectors: {
        size: CONST_VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log(`[Qdrant] Collection '${collectionName}' created with size ${CONST_VECTOR_SIZE}.`);

    await ensurePayloadIndices(collectionName, {});

  } catch (err) {
    console.error(`[Qdrant] Init error:`, err.message);
  }
}

/**
 * Asserts the required Payload Indices exist for efficient search filtering.
 * Includes 'priority' and 'language' fields added in the v2 upgrade.
 */
async function ensurePayloadIndices(collectionName, existingSchema = {}) {
  const fields = ["project_id", "file_path", "language", "priority"];

  for (const field of fields) {
    if (!existingSchema[field]) {
      try {
        await qdrant.createPayloadIndex(collectionName, {
          field_name: field,
          field_schema: "keyword"
        });
        console.log(`[Qdrant] Created payload index for field '${field}'.`);
      } catch (err) {
        // Likely already exists — safe to ignore
        console.warn(`[Qdrant] Could not create payload index for '${field}': ${err.message}`);
      }
    }
  }
}

/**
 * Upsert embeddings representing file chunks into Qdrant.
 * @param {string} collectionName
 * @param {Array}  points - { id, vector, payload }
 */
async function upsertFileChunks(collectionName, points) {
  if (!points || points.length === 0) return;

  const dim = points[0].vector.length;
  if (dim !== CONST_VECTOR_SIZE) {
    const errMsg = `Dimension mismatch on upsert: Expected ${CONST_VECTOR_SIZE}, got ${dim}`;
    console.error(`[Qdrant] ${errMsg}`);
    throw new Error(errMsg);
  }

  try {
    await qdrant.upsert(collectionName, {
      wait: true,
      points: points
    });
    console.log(`[Qdrant] Upserted ${points.length} chunks into ${collectionName} (Dimension: ${dim})`);
  } catch (err) {
    console.error(`[Qdrant] Upsert error:`, err.message);
  }
}

/**
 * Search Qdrant for the most relevant file chunks.
 * @param {string} collectionName
 * @param {Array<number>} queryVector
 * @param {number} limit
 * @param {object} filter - Qdrant filter parameter
 */
async function searchSimilarChunks(collectionName, queryVector, limit = 5, filter = null) {
  if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
    console.error(`[Qdrant Validation Error] Invalid search vector. Received: ${typeof queryVector}`);
    return [];
  }

  const dim = queryVector.length;
  if (dim !== CONST_VECTOR_SIZE) {
    const errMsg = `Dimension mismatch on search: Expected ${CONST_VECTOR_SIZE}, got ${dim}`;
    console.error(`[Qdrant Validation Error] ${errMsg}`);
    throw new Error(errMsg);
  }

  const sample = queryVector.slice(0, 3).map(v => Number(v).toFixed(4)).join(", ");
  console.log(`[Qdrant] Initiating search on collection '${collectionName}' (limit=${limit}).`);
  console.log(`[Qdrant] Search Filter:`, JSON.stringify(filter));
  console.log(`[Qdrant] Query Vector properties -> Length: ${dim}, First 3 vals: [${sample} ...]`);

  try {
    const results = await qdrant.search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: true,
      filter
    });
    return results;
  } catch (err) {
    console.error(`[Qdrant Search Execution Error]:`, err.message || err);
    if (err.data) {
      console.error(`[Qdrant API Details]:`, JSON.stringify(err.data));
    }
    return [];
  }
}

/**
 * Delete ALL Qdrant points belonging to a specific project.
 * Called automatically when the embedding version changes (strategy upgrade).
 *
 * @param {string} collectionName
 * @param {string} projectId
 * @returns {number} count of deleted points (approximate)
 */
async function deleteProjectChunks(collectionName, projectId) {
  try {
    const result = await qdrant.delete(collectionName, {
      filter: {
        must: [
          { key: "project_id", match: { value: projectId.toString() } }
        ]
      },
      wait: true
    });
    console.log(`[Qdrant] Deleted all vectors for project '${projectId}' from '${collectionName}'.`, result);
    return result;
  } catch (err) {
    console.error(`[Qdrant] Error deleting project chunks for '${projectId}':`, err.message);
    return null;
  }
}

module.exports = {
  initCollection,
  upsertFileChunks,
  searchSimilarChunks,
  deleteProjectChunks,
};
