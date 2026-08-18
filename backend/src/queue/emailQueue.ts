import { Queue } from "bullmq";
import { getRedisConnection } from "../db/redis";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export interface EmailJobPayload {
  emailJobId: string;
}

let emailQueue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue(): Queue<EmailJobPayload> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    });
  }
  return emailQueue;
}

export async function enqueueEmailJob(
  emailJobId: string,
  scheduledAt: Date
): Promise<string> {
  const queue = getEmailQueue();
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await queue.add(
    "send-email",
    { emailJobId },
    {
      jobId: emailJobId,
      delay: delayMs,
    }
  );

  return job.id ?? emailJobId;
}

export async function rescheduleEmailJob(
  emailJobId: string,
  runAt: Date
): Promise<void> {
  const queue = getEmailQueue();
  const existing = await queue.getJob(emailJobId);
  if (existing) {
    await existing.remove();
  }

  const delayMs = Math.max(0, runAt.getTime() - Date.now());
  await queue.add(
    "send-email",
    { emailJobId },
    {
      jobId: emailJobId,
      delay: delayMs,
    }
  );
}
