import { spawn } from "node:child_process";
import { resolve } from "node:path";

const wrangler = resolve("node_modules/.bin/wrangler");
const workers = [
  ["-c", "apps/relay/wrangler.json", "--port", "8788"],
  [
    "-c",
    "apps/web/wrangler.json",
    "--port",
    "8787",
    "--var",
    "RELAY_URL:ws://localhost:8788/",
  ],
].map((args) =>
  spawn(process.execPath, [wrangler, "dev", ...args, "--inspector-port", "0"], {
    stdio: "inherit",
  }),
);

let stopping = false;
function stop(signal = "SIGINT") {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const worker of workers) {
    if (worker.exitCode === null && worker.signalCode === null) {
      worker.kill(signal);
    }
  }
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop("SIGTERM"));
for (const worker of workers) {
  worker.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
    stop();
  });
  worker.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
