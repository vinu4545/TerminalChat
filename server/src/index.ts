
import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT) || 4545;

app.listen(PORT, () => {
  console.log(
    `Prosperity Terminal Workspace API running on http://localhost:${PORT}`
  );
});