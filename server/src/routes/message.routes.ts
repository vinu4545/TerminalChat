
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const tokenSchema = z.string().min(1);
const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }
  return secret;
}

async function authenticateRequest(req: any) {
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

    const member = await prisma.member.findFirst({
      where: {
        id: decoded.sub,
        workspaceId: decoded.workspaceId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        workspaceId: true,
      },
    });

    return member;
  } catch {
    return null;
  }
}

router.get("/", async (req, res) => {
  const member = await authenticateRequest(req);

  if (!member) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const limit = Math.min(
    Math.max(Number(req.query.limit) || 50, 1),
    100
  );

  const messages = await prisma.message.findMany({
    where: { workspaceId: member.workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: {
        select: { id: true, username: true, role: true },
      },
      attachments: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    messages: messages.reverse(),
  });
});

router.post("/", async (req, res) => {
  const member = await authenticateRequest(req);

  if (!member) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const parsed = sendMessageSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Message must contain between 1 and 5000 characters.",
    });
  }

  const message = await prisma.message.create({
    data: {
      workspaceId: member.workspaceId,
      senderId: member.id,
      content: parsed.data.content,
    },
    include: {
      sender: {
        select: { id: true, username: true, role: true },
      },
      attachments: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message,
  });
});

export default router;
