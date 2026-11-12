import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { seedWiki } from "./seed-preview.ts";

export function previewURL(
  record: Record<string, unknown>,
  worker: string,
  branch: string,
): URL {
  if (
    record.worker_name !== worker ||
    record.preview_name !== branch ||
    !Array.isArray(record.preview_urls)
  ) {
    throw new Error("Unrecognized Preview deployment");
  }
  for (const candidate of record.preview_urls) {
    if (typeof candidate !== "string") {
      continue;
    }
    const url = new URL(candidate);
    if (
      url.protocol === "https:" &&
      url.host.split(".")[0] === `${record.preview_slug}-${worker}` &&
      url.host.endsWith(".workers.dev")
    ) {
      return new URL(url.origin);
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
    // Wrangler's timestamp-prefixed names sort in creation order.
    const files = (await readdir(directory))
      .filter(
        (name) => name.startsWith("wrangler-output-") && name.endsWith(".json"),
      )
      .sort();
    const latest = files.at(-1);
    if (!latest) {
      throw new Error("No Wrangler output file found");
    }
    path = join(directory, latest);
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
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  seedDeployedPreview().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
