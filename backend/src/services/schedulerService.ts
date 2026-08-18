import { parse } from "csv-parse/sync";
import { prisma } from "../db/prisma";
import { enqueueEmailJob, getEmailQueue } from "../queue/emailQueue";

export function parseLeadEmails(fileContent: string): string[] {
  const trimmed = fileContent.trim();
  if (!trimmed) return [];

  const emails = new Set<string>();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (trimmed.includes(",") || trimmed.includes("\n")) {
    try {
      const records = parse(trimmed, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as string[][];

      for (const row of records) {
        for (const cell of row) {
          const match = String(cell).trim().match(emailRegex);
          if (match) emails.add(match[0].toLowerCase());
        }
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  if (emails.size === 0) {
    for (const line of trimmed.split(/\r?\n/)) {
      const value = line.trim().replace(/^"|"$/g, "");
      const match = value.match(emailRegex);
      if (match) emails.add(match[0].toLowerCase());
    }
  }

  return Array.from(emails);
}

export interface ScheduleCampaignInput {
  userId: string;
  subject: string;
  body: string;
  leads: string[];
  startTime: Date;
  delayBetweenMs: number;
  hourlyLimit: number;
  senderEmails: string[];
}

export async function scheduleCampaign(input: ScheduleCampaignInput) {
  const senders = await Promise.all(
    input.senderEmails.map(async (email) => {
      return prisma.sender.upsert({
        where: {
          userId_email: { userId: input.userId, email },
        },
        create: { userId: input.userId, email },
        update: {},
      });
    })
  );

  if (senders.length === 0) {
    throw new Error("At least one sender email is required");
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: input.userId,
      subject: input.subject,
      body: input.body,
      startTime: input.startTime,
      delayBetweenMs: input.delayBetweenMs,
      hourlyLimit: input.hourlyLimit,
    },
  });

  const emailJobs = [];
  let currentScheduledAt = input.startTime.getTime();

  for (let i = 0; i < input.leads.length; i++) {
    const sender = senders[i % senders.length];
    const scheduledAt = new Date(currentScheduledAt);

    emailJobs.push({
      userId: input.userId,
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: input.leads[i],
      subject: input.subject,
      body: input.body,
      scheduledAt,
    });

    currentScheduledAt += input.delayBetweenMs;
  }

  const createdJobs = await prisma.$transaction(
    emailJobs.map((data) => prisma.emailJob.create({ data }))
  );

  for (const job of createdJobs) {
    const bullJobId = await enqueueEmailJob(job.id, job.scheduledAt);
    await prisma.emailJob.update({
      where: { id: job.id },
      data: { bullJobId },
    });
  }

  return {
    campaign,
    scheduledCount: createdJobs.length,
  };
}

export async function recoverPendingJobs(): Promise<number> {
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ["scheduled", "delayed", "processing"] },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const queue = getEmailQueue();
  let recovered = 0;

  for (const job of pendingJobs) {
    const existing = await queue.getJob(job.id);
    if (existing) {
      continue;
    }

    if (job.status === "processing") {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: "scheduled" },
      });
    }

    const runAt =
      job.scheduledAt.getTime() > Date.now() ? job.scheduledAt : new Date();
    const bullJobId = await enqueueEmailJob(job.id, runAt);
    await prisma.emailJob.update({
      where: { id: job.id },
      data: { bullJobId, status: "scheduled" },
    });
    recovered++;
  }

  return recovered;
}
