import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticateRequest, type AuthenticatedMember } from "../lib/auth";
import { broadcastMessage, broadcastMessageDeleted } from "../lib/message-bus";
import { prisma } from "../lib/prisma";
import {
  getSafeUploadPath,
  MAX_UPLOAD_FILES,
  removeUploadedFiles,
  removeStoredFiles,
  upload,
  validateStoredFile,
} from "../lib/uploads";

const router = Router();
const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});
const uploadMessageSchema = z.object({
  content: z.string().trim().max(5000).optional().default(""),
});

async function requireMember(req: Request, res: Response, next: NextFunction) {
  const member = await authenticateRequest(req);
  if (!member) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  res.locals.member = member;
  next();
}

function getMember(res: Response): AuthenticatedMember {
  return res.locals.member as AuthenticatedMember;
}

function uploadFiles(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_UPLOAD_FILES)(req, res, (error) => {
    if (!error) {
      const files = Array.isArray(req.files) ? req.files : [];
      void Promise.all(files.map((file) => validateStoredFile(file))).then((valid) => {
        if (valid.every(Boolean)) {
          next();
          return;
        }
        void removeUploadedFiles(files).finally(() => {
          res.status(400).json({ success: false, message: "One or more files failed content validation." });
        });
      });
      return;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    void removeUploadedFiles(files).finally(() => {
      if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "Each file must be 10 MB or smaller."
          : error.code === "LIMIT_FILE_COUNT"
            ? `You can upload up to ${MAX_UPLOAD_FILES} files at once.`
            : "The uploaded files could not be processed.";
        res.status(400).json({ success: false, message });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message === "UNSUPPORTED_FILE_TYPE"
          ? "One or more files have an unsupported type."
          : "The uploaded files could not be processed.",
      });
    });
  });
}

const messageInclude = {
  sender: { select: { id: true, username: true, role: true } },
  attachments: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
} as const;

router.get("/", requireMember, async (req, res) => {
  const member = getMember(res);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const messages = await prisma.message.findMany({
    where: { workspaceId: member.workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: messageInclude,
  });

  return res.json({ success: true, messages: messages.reverse() });
});

router.get("/attachments", requireMember, async (_req, res) => {
  const member = getMember(res);
  const attachments = await prisma.attachment.findMany({
    where: { message: { workspaceId: member.workspaceId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return res.json({ success: true, attachments });
});

router.post("/", requireMember, async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Message must contain between 1 and 5000 characters.",
    });
  }

  const member = getMember(res);
  const message = await prisma.message.create({
    data: {
      workspaceId: member.workspaceId,
      senderId: member.id,
      content: parsed.data.content,
    },
    include: messageInclude,
  });

  broadcastMessage(member.workspaceId, message);
  return res.status(201).json({ success: true, message });
});

router.post("/upload", requireMember, uploadFiles, async (req, res) => {
  const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
  const parsed = uploadMessageSchema.safeParse(req.body);

  if (!parsed.success || (!parsed.data.content && files.length === 0)) {
    await removeUploadedFiles(files);
    return res.status(400).json({
      success: false,
      message: "Add a message or at least one file before sending.",
    });
  }

  const member = getMember(res);

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          workspaceId: member.workspaceId,
          senderId: member.id,
          content: parsed.data.content,
        },
      });

      await tx.attachment.createMany({
        data: files.map((file) => ({
          messageId: created.id,
          uploaderId: member.id,
          originalName: file.originalname.slice(0, 255),
          storageKey: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        })),
      });

      return tx.message.findUniqueOrThrow({
        where: { id: created.id },
        include: messageInclude,
      });
    });

    broadcastMessage(member.workspaceId, message);
    return res.status(201).json({ success: true, message });
  } catch (error) {
    await removeUploadedFiles(files);
    console.error("Failed to save uploaded message:", error);
    return res.status(500).json({
      success: false,
      message: "Could not save the uploaded message.",
    });
  }
});

router.delete("/:messageId", requireMember, async (req, res) => {
  const member = getMember(res);
  const message = await prisma.message.findFirst({
    where: {
      id: String(req.params.messageId),
      workspaceId: member.workspaceId,
    },
    select: {
      id: true,
      senderId: true,
      attachments: { select: { id: true, storageKey: true } },
    },
  });

  if (!message) {
    return res.status(404).json({ success: false, message: "Message not found." });
  }

  if (message.senderId !== member.id) {
    return res.status(403).json({
      success: false,
      message: "You can only delete your own messages.",
    });
  }

  await prisma.$transaction((tx) => tx.message.delete({ where: { id: message.id } }));

  const attachmentIds = message.attachments.map((attachment) => attachment.id);
  await removeStoredFiles(message.attachments.map((attachment) => attachment.storageKey));
  broadcastMessageDeleted(member.workspaceId, message.id, attachmentIds);

  return res.json({ success: true, messageId: message.id, attachmentIds });
});

router.get("/attachments/:attachmentId/download", requireMember, async (req, res) => {
  const member = getMember(res);
  const attachment = await prisma.attachment.findUnique({
    where: { id: String(req.params.attachmentId) },
    include: { message: { select: { workspaceId: true } } },
  });

  if (!attachment || attachment.message.workspaceId !== member.workspaceId) {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }

  try {
    const filePath = getSafeUploadPath(attachment.storageKey);
    await stat(filePath);
    const safeName = attachment.originalName.replace(/[^a-zA-Z0-9._ ()-]/g, "_");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    createReadStream(filePath).on("error", () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: "Attachment not found." });
    }).pipe(res);
  } catch {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }
});

export default router;
