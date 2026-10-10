
import express from "express";
import cors from "cors";
import roomRoutes from "./routes/room.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Prosperity Terminal Workspace API is running",
  });
});

app.use("/api/rooms", roomRoutes);

export default app;
