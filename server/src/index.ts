
import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { initializeSocketServer } from "./realtime/socket";

const PORT = Number(process.env.PORT) || 4545;

const httpServer = createServer(app);

initializeSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(
    `Prosperity Terminal Workspace API running on http://localhost:${PORT}`
  );
});
