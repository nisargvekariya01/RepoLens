const { Queue } = require("bullmq");
const connection = require("../config/redis");

const syncQueue = connection
  ? new Queue("project-sync", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  : null;

/**
 * Adds a new sync job to the queue.
 * @param {string} projectId 
 */
async function addSyncJob(projectId) {
  if (!syncQueue) {
    console.error("❌ Sync queue not initialized. Redis might be down.");
    return null;
  }

  const job = await syncQueue.add("sync-job", { projectId });
  console.log(`📦 Job queued: ${job.id} for project ${projectId}`);
  return job;
}

/**
 * Sets an auto-synchronization interval for a project using BullMQ Repeatable Jobs.
 * @param {string} projectId 
 * @param {number} hours 
 */
async function setAutoSync(projectId, hours) {
  if (!syncQueue) return;

  const jobId = `auto-sync-${projectId}`;
  
  // Clean up any existing repeating jobs bound to this project ID
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id === jobId) {
      await syncQueue.removeRepeatableByKey(job.key);
    }
  }

  // If hours is greater than 0, establish the new recurring heartbeat
  if (hours > 0) {
    await syncQueue.add("sync-job", { projectId, isAuto: true }, {
      repeat: {
        every: hours * 60 * 60 * 1000
      },
      jobId
    });
    console.log(`⏱️ Auto-sync established for ${projectId} every ${hours} hours.`);
  } else {
    console.log(`🛑 Auto-sync disabled for ${projectId}.`);
  }
}

module.exports = {
  syncQueue,
  addSyncJob,
  setAutoSync,
};
