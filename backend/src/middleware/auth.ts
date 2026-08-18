import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  googleId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function verifyNextAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const secret = new TextEncoder().encode(env.nextAuthSecret);
    const { payload } = await jwtVerify(token, secret);

    const email = payload.email as string | undefined;
    const googleId = (payload.googleId ?? payload.sub) as string | undefined;

    if (!email || !googleId) {
      return null;
    }

    return {
      id: (payload.userId as string) ?? googleId,
      email,
      name: (payload.name as string) ?? null,
      picture: (payload.picture as string) ?? null,
      googleId,
    };
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length);
  const authUser = await verifyNextAuthToken(token);

  if (!authUser) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const user = await prisma.user.upsert({
    where: { googleId: authUser.googleId },
    create: {
      googleId: authUser.googleId,
      email: authUser.email,
      name: authUser.name,
      avatar: authUser.picture,
    },
    update: {
      email: authUser.email,
      name: authUser.name,
      avatar: authUser.picture,
    },
  });

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.avatar,
    googleId: user.googleId,
  };

  next();
}
