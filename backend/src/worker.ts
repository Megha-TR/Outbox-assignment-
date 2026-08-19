import { env } from "./config/env";
import { createEmailWorker } from "./queue/emailWorker";
import { recoverPendingJobs } from "./services/schedulerService";

async function startWorker() {
  // Log clearly so Railway logs confirm which mode is active
  if (env.simulateEmail) {
    console.log(
      "[worker] SIMULATE_EMAIL=true — nodemailer jsonTransport active (no SMTP)"
    );
  } else {
    console.log(
      `[worker] SMTP mode — host=${env.smtpHost}:${env.smtpPort} (set SIMULATE_EMAIL=true on Railway to bypass blocked port 587)`
    );
  }

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
