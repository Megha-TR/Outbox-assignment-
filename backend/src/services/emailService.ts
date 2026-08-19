import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

const transporterCache = new Map<string, Transporter>();

export async function getOrCreateTransporter(
  senderEmail: string,
  smtpUser?: string | null,
  smtpPass?: string | null
): Promise<{ transporter: Transporter; previewUrl?: string; smtpUser: string; smtpPass: string }> {
  const cacheKey = `${senderEmail}:${smtpUser ?? "default"}`;
  const cached = transporterCache.get(cacheKey);
  if (cached) {
    return {
      transporter: cached,
      smtpUser: smtpUser!,
      smtpPass: smtpPass!,
    };
  }

  let user = smtpUser ?? env.etherealUser;
  let pass = smtpPass ?? env.etherealPass;

  if (!user || !pass) {
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user, pass },
    // A blocked SMTP port must not leave a BullMQ job in `processing` forever.
    connectionTimeout: env.smtpConnectionTimeoutMs,
    greetingTimeout: env.smtpConnectionTimeoutMs,
    socketTimeout: env.smtpConnectionTimeoutMs,
  });

  transporterCache.set(cacheKey, transporter);

  return { transporter, smtpUser: user, smtpPass: pass };
}

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  smtpUser?: string | null;
  smtpPass?: string | null;
}): Promise<{ messageId: string; previewUrl?: string; smtpUser: string; smtpPass: string }> {
  // ---------------------------------------------------------------------------
  // SIMULATE_EMAIL mode — used on Railway where outbound SMTP (port 587) is
  // blocked.  nodemailer's jsonTransport builds the full RFC-2822 message in
  // memory and returns it as JSON; no network connection is made.  All
  // scheduling, BullMQ queuing, rate-limiting and DB persistence still work
  // end-to-end — only the physical SMTP handshake is skipped.
  // ---------------------------------------------------------------------------
  if (env.simulateEmail) {
    const simTransport = nodemailer.createTransport({ jsonTransport: true });
    const info = await simTransport.sendMail({
      from: `"ReachInbox Scheduler" <${params.from}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: `<p>${params.body.replace(/\n/g, "<br/>")}</p>`,
    });

    console.log(
      `[SIMULATE] Email to ${params.to} | subject: "${params.subject}" | messageId: ${info.messageId}`
    );

    return {
      messageId: info.messageId,
      previewUrl: `[Simulated — SMTP blocked on Railway] from=${params.from} to=${params.to}`,
      smtpUser: params.smtpUser ?? "simulated",
      smtpPass: params.smtpPass ?? "simulated",
    };
  }

  // ---------------------------------------------------------------------------
  // Normal Ethereal SMTP path (local dev)
  // ---------------------------------------------------------------------------
  const { transporter, smtpUser, smtpPass } = await getOrCreateTransporter(
    params.from,
    params.smtpUser,
    params.smtpPass
  );

  const info = await transporter.sendMail({
    from: `"ReachInbox Scheduler" <${params.from}>`,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<p>${params.body.replace(/\n/g, "<br/>")}</p>`,
  });

  const previewUrlRaw = nodemailer.getTestMessageUrl(info);
  const previewUrl = previewUrlRaw ? previewUrlRaw : undefined;

  return {
    messageId: info.messageId,
    previewUrl,
    smtpUser,
    smtpPass,
  };
}
