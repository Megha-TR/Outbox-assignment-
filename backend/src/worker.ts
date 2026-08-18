import { env } from "./config/env";
import { createEmailWorker } from "./queue/emailWorker";
import { recoverPendingJobs } from "./services/schedulerService";

async function startWorker() {
  const recovered = await recoverPendingJobs();
  if (recovered > 0) {
    console.log(`Worker recovered ${recovered} pending email jobs`);
  }

  const worker = createEmailWorker();

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  console.log(
    `Email worker started (concurrency=${env.workerConcurrency}, minDelay=${env.minDelayBetweenEmailsMs}ms)`
  );
}

startWorker().catch((error) => {
  console.error("Failed to start worker", error);
  process.exit(1);
});
