import { Worker, Job } from "bullmq";
import { EmailStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { getRedisConnection } from "../db/redis";
import { EMAIL_QUEUE_NAME, EmailJobPayload, rescheduleEmailJob } from "./emailQueue";
import { sendEmail } from "../services/emailService";
import {
  checkGlobalRateLimit,
  checkSenderRateLimit,
  decrementRateLimits,
} from "../services/rateLimitService";

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailJobId } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: {
      sender: true,
      campaign: true,
    },
  });

  if (!emailJob) {
    return;
  }

  if (emailJob.status === EmailStatus.sent) {
    return;
  }

  const globalLimit = await checkGlobalRateLimit();
  if (!globalLimit.allowed) {
    const retryAt = new Date(Date.now() + (globalLimit.retryAfterMs ?? 60_000));
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: EmailStatus.delayed, scheduledAt: retryAt },
    });
    await rescheduleEmailJob(emailJobId, retryAt);
    return;
  }

  const senderLimit = await checkSenderRateLimit(
    emailJob.senderId,
    emailJob.campaign.hourlyLimit
  );
  if (!senderLimit.allowed) {
    await decrementRateLimits(emailJob.senderId);
    const retryAt = new Date(Date.now() + (senderLimit.retryAfterMs ?? 60_000));
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: EmailStatus.delayed, scheduledAt: retryAt },
    });
    await rescheduleEmailJob(emailJobId, retryAt);
    return;
  }

  const claimed = await prisma.emailJob.updateMany({
    where: {
      id: emailJobId,
      status: { in: [EmailStatus.scheduled, EmailStatus.delayed] },
    },
    data: { status: EmailStatus.processing },
  });

  if (claimed.count === 0) {
    return;
  }

  try {
    const result = await sendEmail({
      from: emailJob.sender.email,
      to: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      smtpUser: emailJob.sender.smtpUser,
      smtpPass: emailJob.sender.smtpPass,
    });

    if (!emailJob.sender.smtpUser || !emailJob.sender.smtpPass) {
      await prisma.sender.update({
        where: { id: emailJob.senderId },
        data: { smtpUser: result.smtpUser, smtpPass: result.smtpPass },
      });
    }

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.sent,
        sentAt: new Date(),
        errorMessage: result.previewUrl ?? null,
      },
    });
  } catch (error) {
    await decrementRateLimits(emailJob.senderId);
    const message = error instanceof Error ? error.message : "Unknown send error";
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.failed,
        errorMessage: message,
      },
    });
    throw error;
  }
}

export function createEmailWorker(): Worker<EmailJobPayload> {
  return new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: getRedisConnection(),
      concurrency: env.workerConcurrency,
      limiter: {
        max: 1,
        duration: env.minDelayBetweenEmailsMs,
      },
    }
  );
}
