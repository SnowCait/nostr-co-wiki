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
export async function readPreviewOutput(worker: string, branch: string) {
  const file = process.env.WRANGLER_OUTPUT_FILE_PATH;
  const directory = process.env.WRANGLER_OUTPUT_FILE_DIRECTORY;
  let path: string;
  if (file) {
    path = file;
  } else if (directory) {
    // Wrangler names files with a UTC millisecond timestamp and random suffix.
    const files = (await readdir(directory))
      .map((name) => ({
        name,
        match:
          /^wrangler-output-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d{3})-[a-f0-9]{6}\.json$/.exec(
            name,
          ),
      }))
      .filter((entry) => entry.match)
      .sort((a, b) => b.match![1].localeCompare(a.match![1]));
    if (
      !files.length ||
      (files.length > 1 && files[0].match![1] === files[1].match![1])
    ) {
      throw new Error(
        "Cannot uniquely identify the latest Wrangler output file",
      );
    }
    path = join(directory, files[0].name);
  } else {
    throw new Error("Wrangler output destination is not configured");
  }
  const records = (await readFile(path, "utf8"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const session = records.findLastIndex(
    (record) => record.type === "wrangler-session",
  );
  if (session < 0) {
    throw new Error("Missing Wrangler session in output");
  }
  const previews = records
    .slice(session + 1)
    .filter((record) => record.type === "preview");
  if (previews.length !== 1) {
    throw new Error(
      `Expected one Preview deployment in the latest session; found ${previews.length}`,
    );
  }
  return previewURL(previews[0], worker, branch);
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
