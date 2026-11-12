import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { seedWiki } from "./seed-preview.ts";

export function previewURL(
  record: Record<string, unknown>,
  worker: string,
  branch: string,
): URL {
  if (
    record.type !== "preview" ||
    record.version !== 1 ||
    record.worker_name !== worker ||
    record.preview_name !== branch ||
    typeof record.preview_id !== "string" ||
    !record.preview_id ||
    typeof record.deployment_id !== "string" ||
    !record.deployment_id ||
    typeof record.preview_slug !== "string" ||
    !/^[a-z0-9-]+$/.test(record.preview_slug) ||
    !Array.isArray(record.preview_urls)
  ) {
    throw new Error("Unrecognized Preview deployment");
  }
  for (const candidate of record.preview_urls) {
    if (typeof candidate !== "string") {
      continue;
    }
    const url = new URL(candidate);
    const labels = url.hostname.split(".");
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      labels.length === 4 &&
      labels[0] === `${record.preview_slug}-${worker}` &&
      labels.slice(2).join(".") === "workers.dev"
    ) {
      return url;
    }
  }
  throw new Error("No verified workers.dev Preview URL");
}
// The npm script records its start before running Wrangler. Record timestamps
// distinguish this invocation from previous output without modifying its destination.
export async function readPreviewOutput(worker: string, branch: string) {
  const started = Number(process.env.WIKI_PREVIEW_STARTED_AT);
  const now = Date.now();
  if (!Number.isSafeInteger(started) || started <= 0 || started > now) {
    throw new Error("Missing or invalid Preview invocation start time");
  }
  const file = process.env.WRANGLER_OUTPUT_FILE_PATH;
  const directory = process.env.WRANGLER_OUTPUT_FILE_DIRECTORY;
  let paths: string[];
  if (file) {
    paths = [file];
  } else if (directory) {
    paths = (await readdir(directory))
      .filter((name) => /^wrangler-output-.+\.json$/.test(name))
      .map((name) => join(directory, name));
  } else {
    throw new Error("Wrangler output destination is not configured");
  }
  const candidates: URL[] = [];
  for (const path of paths) {
    const records = (await readFile(path, "utf8"))
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    for (const record of records) {
      const timestamp = Date.parse(record.timestamp);
      if (
        record.type !== "preview" ||
        record.worker_name !== worker ||
        record.preview_name !== branch ||
        !Number.isFinite(timestamp) ||
        timestamp < started ||
        timestamp > now
      ) {
        continue;
      }
      candidates.push(previewURL(record, worker, branch));
    }
  }
  if (candidates.length !== 1) {
    throw new Error(
      `Expected one current Preview deployment; found ${candidates.length}`,
    );
  }
  return candidates[0];
}
export async function seedDeployedPreview() {
  const branch = process.env.WORKERS_CI_BRANCH;
  if (process.env.WORKERS_CI !== "1" || !branch || branch === "main") {
    throw new Error("Run only as a Workers Builds Preview command");
  }
  const { name } = JSON.parse(
    await readFile(new URL("../wrangler.json", import.meta.url), "utf8"),
  );
  await seedWiki(await readPreviewOutput(name, branch));
}
if (import.meta.main) {
  seedDeployedPreview().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
