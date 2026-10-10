
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";

interface AuthenticatedSocketUser {
  memberId: string;
  workspaceId: string;
  username: string;
  role: string;
}

interface TokenPayload extends JwtPayload {
  workspaceId: string;
  username: string;
  role: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  return secret;
}

function getAuthenticatedUser(
  token: string
): AuthenticatedSocketUser {
  const decoded = jwt.verify(token, getJwtSecret());

  if (
    typeof decoded === "string" ||
    !decoded.sub ||
    typeof decoded.workspaceId !== "string" ||
    typeof decoded.username !== "string" ||
    typeof decoded.role !== "string"
  ) {
    throw new Error("INVALID_TOKEN");
  }

  const payload = decoded as TokenPayload;

  return {
    memberId: payload.sub as string,
    workspaceId: payload.workspaceId,
    username: payload.username,
    role: payload.role,
  };
}

export function initializeSocketServer(httpServer: HttpServer) {
  const allowedOrigin = process.env.FRONTEND_URL;

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || !token) {
        return next(new Error("Authentication required."));
      }

      const user = getAuthenticatedUser(token);

      socket.data.user = user;

      next();
    } catch {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthenticatedSocketUser;
    const roomName = `workspace:${user.workspaceId}`;

    try {
      const member = await prisma.member.findFirst({
        where: {
          id: user.memberId,
          workspaceId: user.workspaceId,
          username: user.username,
          role: user.role,
        },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });

      if (!member) {
        socket.disconnect(true);
        return;
      }

      await socket.join(roomName);

      await prisma.member.update({
        where: { id: member.id },
        data: { lastSeenAt: new Date() },
      });

      socket.emit("connection:ready", {
        member: {
          id: member.id,
          username: member.username,
          role: member.role,
        },
        workspaceId: user.workspaceId,
      });

      // Send this socket the complete online list for the workspace.
      // Multiple tabs/sockets for the same member are represented once.
      const workspaceSockets = await io.in(roomName).fetchSockets();
      const onlineMembers = new Map<
        string,
        { memberId: string; username: string; role: string }
      >();

      for (const connectedSocket of workspaceSockets) {
        const connectedUser = connectedSocket.data.user as
          | AuthenticatedSocketUser
          | undefined;
        if (connectedUser) {
          onlineMembers.set(connectedUser.memberId, {
            memberId: connectedUser.memberId,
            username: connectedUser.username,
            role: connectedUser.role,
          });
        }
      }

      socket.emit("presence:list", { members: [...onlineMembers.values()] });

      // Tell everyone else that this member has joined. Avoid treating a
      // second tab from the same member as a second person.
      const otherMemberWasAlreadyOnline = workspaceSockets.some(
        (connectedSocket) =>
          connectedSocket.id !== socket.id &&
          (connectedSocket.data.user as AuthenticatedSocketUser | undefined)
            ?.memberId === member.id
      );
      if (!otherMemberWasAlreadyOnline) {
        socket.to(roomName).emit("presence:changed", {
          memberId: member.id,
          username: member.username,
          role: member.role,
          status: "online",
        });
      }


      socket.on(
        "message:send",
        async (
          payload: { content?: unknown },
          acknowledge?: (result: {
            success: boolean;
            message?: unknown;
            error?: string;
          }) => void
        ) => {
          try {
            if (
              typeof payload?.content !== "string" ||
              !payload.content.trim() ||
              payload.content.trim().length > 5000
            ) {
              acknowledge?.({
                success: false,
                error: "Message must contain between 1 and 5000 characters.",
              });
              return;
            }

            const savedMessage = await prisma.message.create({
              data: {
                workspaceId: user.workspaceId,
                senderId: member.id,
                content: payload.content.trim(),
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    role: true,
                  },
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

            io.to(roomName).emit("message:new", savedMessage);

            acknowledge?.({
              success: true,
              message: savedMessage,
            });
          } catch (error) {
            console.error("Failed to send real-time message:", error);
            acknowledge?.({
              success: false,
              error: "Could not send message. Please try again.",
            });
          }
        }
      );

      socket.on("disconnect", async () => {
        try {
          // Socket.IO removes the disconnecting socket from its rooms before
          // this callback. Keep the member online if another tab is connected.
          const remainingSockets = await io.in(roomName).fetchSockets();
          const memberStillConnected = remainingSockets.some(
            (connectedSocket) =>
              (connectedSocket.data.user as AuthenticatedSocketUser | undefined)
                ?.memberId === member.id
          );

          if (!memberStillConnected) {
            io.to(roomName).emit("presence:changed", {
              memberId: member.id,
              username: member.username,
              role: member.role,
              status: "offline",
            });
          }
        } catch (error) {
          console.error("Failed to update member presence:", error);
        }
      });
    } catch (error) {
      console.error("Socket connection initialization failed:", error);
      socket.disconnect(true);
    }
  });

  return io;
}
