import { redis } from "../db/redis";
import { env } from "../config/env";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

function getHourWindow(timestamp = Date.now()): number {
  return Math.floor(timestamp / (60 * 60 * 1000));
}

function msUntilNextHour(timestamp = Date.now()): number {
  const nextHour = (getHourWindow(timestamp) + 1) * 60 * 60 * 1000;
  return Math.max(0, nextHour - timestamp);
}

async function incrementCounter(key: string): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60 + 60);
  }
  return count;
}

export async function checkGlobalRateLimit(): Promise<RateLimitResult> {
  const window = getHourWindow();
  const key = `rate:global:${window}`;
  const count = await incrementCounter(key);

  if (count > env.maxEmailsPerHour) {
    await redis.decr(key);
    return { allowed: false, retryAfterMs: msUntilNextHour() };
  }

  return { allowed: true };
}

export async function checkSenderRateLimit(
  senderId: string,
  campaignHourlyLimit: number
): Promise<RateLimitResult> {
  const perSenderLimit = Math.min(
    campaignHourlyLimit,
    env.maxEmailsPerHourPerSender
  );
  const window = getHourWindow();
  const key = `rate:sender:${senderId}:${window}`;
  const count = await incrementCounter(key);

  if (count > perSenderLimit) {
    await redis.decr(key);
    return { allowed: false, retryAfterMs: msUntilNextHour() };
  }

  return { allowed: true };
}

export async function decrementRateLimits(senderId: string): Promise<void> {
  const window = getHourWindow();
  await redis.decr(`rate:global:${window}`);
  await redis.decr(`rate:sender:${senderId}:${window}`);
}
