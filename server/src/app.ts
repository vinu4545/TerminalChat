
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import roomRoutes from "./routes/room.routes";
import messageRoutes from "./routes/message.routes";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Prosperity Terminal Workspace API is running",
  });
});

app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);

export default app;
