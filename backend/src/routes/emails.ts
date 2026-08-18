import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { EmailStatus } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { parseLeadEmails, scheduleCampaign } from "../services/schedulerService";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authMiddleware);

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.string().datetime(),
  delayBetweenMs: z.coerce.number().int().min(0),
  hourlyLimit: z.coerce.number().int().min(1),
  senderEmails: z.union([z.string(), z.array(z.string())]).optional(),
});

router.post("/schedule", upload.single("leadsFile"), async (req, res) => {
  try {
    const parsed = scheduleSchema.parse(req.body);
    const fileContent =
      req.file?.buffer.toString("utf-8") ??
      (typeof req.body.leadsText === "string" ? req.body.leadsText : "");

    const leads = parseLeadEmails(fileContent);
    if (leads.length === 0) {
      res.status(400).json({ error: "No valid email addresses found in file" });
      return;
    }

    let senderEmails: string[] = [];
    if (parsed.senderEmails) {
      senderEmails = Array.isArray(parsed.senderEmails)
        ? parsed.senderEmails
        : parsed.senderEmails.split(",").map((s) => s.trim());
    }

    if (senderEmails.length === 0 && req.user?.email) {
      senderEmails = [req.user.email];
    }

    const startTime = new Date(parsed.startTime);
    if (Number.isNaN(startTime.getTime())) {
      res.status(400).json({ error: "Invalid start time" });
      return;
    }
    if (startTime.getTime() <= Date.now()) {
      res.status(400).json({ error: "Start time must be in the future" });
      return;
    }

    const result = await scheduleCampaign({
      userId: req.user!.id,
      subject: parsed.subject,
      body: parsed.body,
      leads,
      startTime,
      delayBetweenMs: parsed.delayBetweenMs,
      hourlyLimit: parsed.hourlyLimit,
      senderEmails,
    });

    res.status(201).json({
      campaignId: result.campaign.id,
      scheduledCount: result.scheduledCount,
      leadsDetected: leads.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.flatten() });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Failed to schedule emails" });
  }
});

router.post("/parse-leads", upload.single("leadsFile"), async (req, res) => {
  const fileContent =
    req.file?.buffer.toString("utf-8") ??
    (typeof req.body.leadsText === "string" ? req.body.leadsText : "");

  const leads = parseLeadEmails(fileContent);
  res.json({ count: leads.length, emails: leads.slice(0, 5) });
});

router.get("/scheduled", async (req, res) => {
  const emails = await prisma.emailJob.findMany({
    where: {
      userId: req.user!.id,
      status: { in: [EmailStatus.scheduled, EmailStatus.delayed, EmailStatus.processing] },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      scheduledAt: true,
      status: true,
    },
  });

  res.json({ emails });
});

router.get("/sent", async (req, res) => {
  const emails = await prisma.emailJob.findMany({
    where: {
      userId: req.user!.id,
      status: { in: [EmailStatus.sent, EmailStatus.failed] },
    },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      sentAt: true,
      status: true,
      errorMessage: true,
    },
  });

  res.json({ emails });
});

router.get("/me", async (req, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    name: req.user!.name,
    avatar: req.user!.picture,
  });
});

export default router;
