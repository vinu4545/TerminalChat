import { Router } from "express";
import { z } from "zod";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { createRoom, joinRoom, leaveRoom } from "../services/room.service";

const router = Router();

const createRoomSchema = z.object({
  roomCode: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(128),
});

const joinRoomSchema = z.object({
  roomCode: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
  displayName: z.string().trim().min(2).max(30).optional(),
});

interface AuthPayload extends JwtPayload {
  workspaceId: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET_NOT_CONFIGURED");
  return secret;
}

function getAuthFromRequest(req: import("express").Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  try {
    const decoded = jwt.verify(header.slice(7), getJwtSecret());
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.workspaceId !== "string"
    ) return null;

    const payload = decoded as AuthPayload;
    return { memberId: payload.sub as string, workspaceId: payload.workspaceId };
  } catch {
    return null;
  }
}

router.post("/", async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Please check your input.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await createRoom(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Terminal created successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_ROOM_CODE") {
        return res.status(400).json({ success: false, message: "Please enter a valid room code." });
      }
      if (error.message === "ROOM_CODE_TAKEN") {
        return res.status(409).json({ success: false, message: "This room code is already in use. Choose another." });
      }
      if (error.message === "INVALID_PASSWORD") {
        return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
      }
      if (error.message === "JWT_SECRET_NOT_CONFIGURED") {
        console.error("JWT_SECRET is missing or too short.");
        return res.status(500).json({ success: false, message: "Authentication is not configured correctly." });
      }
    }
    console.error("Create terminal error:", error);
    return res.status(500).json({ success: false, message: "Could not create terminal. Please try again." });
  }
});

router.post("/join", async (req, res) => {
  const parsed = joinRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Please check your input.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await joinRoom(parsed.data);
    return res.status(200).json({ success: true, message: "Joined terminal successfully.", ...result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_CREDENTIALS") {
        return res.status(401).json({ success: false, message: "Invalid room code or password." });
      }
      if (error.message === "INVALID_DISPLAY_NAME") {
        return res.status(400).json({
          success: false,
          message: "Display name must be 2–30 characters and contain only letters, numbers, spaces, underscores, or hyphens.",
        });
      }
      if (error.message === "DISPLAY_NAME_RESERVED") {
        return res.status(409).json({
          success: false,
          message: "This display name is reserved for the terminal owner. Choose another name.",
        });
      }
      if (error.message === "DISPLAY_NAME_TAKEN") {
        return res.status(409).json({
          success: false,
          message: "This display name is already being used in the terminal. Choose another.",
        });
      }
      if (error.message === "JWT_SECRET_NOT_CONFIGURED") {
        console.error("JWT_SECRET is missing or too short.");
        return res.status(500).json({ success: false, message: "Authentication is not configured correctly." });
      }
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return res.status(409).json({ success: false, message: "This display name is already being used in the terminal." });
    }
    console.error("Join terminal error:", error);
    return res.status(500).json({ success: false, message: "Could not join terminal. Please try again." });
  }
});

/**
 * POST /api/rooms/leave
 * Call this when a user explicitly chooses Leave. Do not call it on refresh
 * or temporary socket disconnect, because those should not release a name.
 */
router.post("/leave", async (req, res) => {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const result = await leaveRoom(auth.memberId, auth.workspaceId);
    return res.status(200).json({ success: true, message: "Left terminal successfully.", ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_CANNOT_LEAVE") {
      return res.status(403).json({
        success: false,
        message: "The terminal owner cannot leave using this action.",
      });
    }
    console.error("Leave terminal error:", error);
    return res.status(500).json({ success: false, message: "Could not leave terminal. Please try again." });
  }
});

export default router;
