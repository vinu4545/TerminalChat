import type { Request } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./prisma";

const tokenSchema = z.string().min(1);

export type AuthenticatedMember = {
  id: string;
  username: string;
  role: string;
  workspaceId: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }
  return secret;
}

export async function authenticateRequest(
  req: Request,
): Promise<AuthenticatedMember | null> {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }

  const parsed = tokenSchema.safeParse(authorization.slice(7));
  if (!parsed.success) return null;

  try {
    const decoded = jwt.verify(parsed.data, getJwtSecret());
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.workspaceId !== "string"
    ) {
      return null;
    }

    const payload = decoded as JwtPayload & { workspaceId: string };
    return prisma.member.findFirst({
      where: {
        id: decoded.sub,
        workspaceId: payload.workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        role: true,
        workspaceId: true,
      },
    });
  } catch {
    return null;
  }
}