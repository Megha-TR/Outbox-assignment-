import express from "express";
import cors from "cors";
import { env } from "./config/env";
import emailRoutes from "./routes/emails";
import { recoverPendingJobs } from "./services/schedulerService";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", emailRoutes);

async function start() {
  const recovered = await recoverPendingJobs();
  if (recovered > 0) {
    console.log(`Recovered ${recovered} pending email jobs on startup`);
  }

  app.listen(env.port, () => {
    console.log(`API server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
