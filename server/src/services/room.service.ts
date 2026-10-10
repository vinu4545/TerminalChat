
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

interface CreateRoomInput {
  roomCode: string;
  password: string;
}

interface JoinRoomInput {
  roomCode: string;
  password: string;
  displayName?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  return secret;
}

function isPrismaError(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function createRoom(input: CreateRoomInput) {
  const roomCode = input.roomCode.trim().toUpperCase();

  if (!roomCode || roomCode.length > 64) {
    throw new Error("INVALID_ROOM_CODE");
  }

  if (input.password.length < 8 || input.password.length > 128) {
    throw new Error("INVALID_PASSWORD");
  }

  const secret = getJwtSecret();
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          roomCode,
          passwordHash,
        },
      });

      const member = await tx.member.create({
        data: {
          workspaceId: workspace.id,
          username: "Owner",
          usernameNormalized: "owner",
          role: "OWNER",
        },
      });

      const token = jwt.sign(
        {
          workspaceId: workspace.id,
          username: member.username,
          role: member.role,
        },
        secret,
        {
          subject: member.id,
          expiresIn: "2h",
        }
      );

      return {
        token,
        room: {
          id: workspace.id,
          roomCode: workspace.roomCode,
          createdAt: workspace.createdAt,
        },
        member: {
          id: member.id,
          username: member.username,
          role: member.role,
        },
      };
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new Error("ROOM_CODE_TAKEN");
    }

    throw error;
  }
}

export async function joinRoom(input: JoinRoomInput) {
  const roomCode = input.roomCode.trim().toUpperCase();

  if (!roomCode || roomCode.length > 64) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!input.password || input.password.length > 128) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { roomCode },
  });

  if (!workspace) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    workspace.passwordHash
  );

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const displayName =
    input.displayName?.trim() ||
    `Guest-${randomBytes(3).toString("hex").toUpperCase()}`;

  if (
    displayName.length < 2 ||
    displayName.length > 30 ||
    !/^[a-zA-Z0-9 _-]+$/.test(displayName)
  ) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  const usernameNormalized = displayName.toLowerCase();

  const existingMember = await prisma.member.findFirst({
    where: {
      workspaceId: workspace.id,
      usernameNormalized,
    },
  });

  if (existingMember) {
    throw new Error("DISPLAY_NAME_TAKEN");
  }

  const secret = getJwtSecret();

  try {
    const member = await prisma.member.create({
      data: {
        workspaceId: workspace.id,
        username: displayName,
        usernameNormalized,
        role: "MEMBER",
      },
    });

    const token = jwt.sign(
      {
        workspaceId: workspace.id,
        username: member.username,
        role: member.role,
      },
      secret,
      {
        subject: member.id,
        expiresIn: "2h",
      }
    );

    return {
      token,
      room: {
        id: workspace.id,
        roomCode: workspace.roomCode,
      },
      member: {
        id: member.id,
        username: member.username,
        role: member.role,
      },
    };
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new Error("DISPLAY_NAME_TAKEN");
    }

    throw error;
  }
}
