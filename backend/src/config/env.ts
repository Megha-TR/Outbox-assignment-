import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  port: optionalInt("PORT", 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  nextAuthSecret: required("NEXTAUTH_SECRET"),
  workerConcurrency: optionalInt("WORKER_CONCURRENCY", 5),
  minDelayBetweenEmailsMs: optionalInt("MIN_DELAY_BETWEEN_EMAILS_MS", 2000),
  maxEmailsPerHour: optionalInt("MAX_EMAILS_PER_HOUR", 200),
  maxEmailsPerHourPerSender: optionalInt("MAX_EMAILS_PER_HOUR_PER_SENDER", 50),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  smtpHost: process.env.SMTP_HOST ?? "smtp.ethereal.email",
  smtpPort: optionalInt("SMTP_PORT", 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpConnectionTimeoutMs: optionalInt("SMTP_CONNECTION_TIMEOUT_MS", 10_000),
  etherealUser: process.env.ETHEREAL_USER,
  etherealPass: process.env.ETHEREAL_PASS,
  // Set to "true" on Railway (or any host that blocks SMTP port 587).
  // Uses nodemailer's jsonTransport to simulate sending locally without a
  // network connection — all scheduling, rate-limiting and persistence still
  // work end-to-end; only the physical SMTP handshake is skipped.
  simulateEmail: process.env.SIMULATE_EMAIL === "true",
};
