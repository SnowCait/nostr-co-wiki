import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
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
export async function deployAndSeed() {
  const branch = process.env.WORKERS_CI_BRANCH;
  if (process.env.WORKERS_CI !== "1" || !branch || branch === "main") {
    throw new Error("Run only as a Workers Builds Preview command");
  }
  const { name } = JSON.parse(
    await readFile(new URL("../wrangler.json", import.meta.url), "utf8"),
  );
  const directory = await mkdtemp(join(tmpdir(), "wiki-preview-"));
  // Preserve Builds' output file (or output directory) so its PR notification
  // still receives Wrangler's unchanged structured Preview record.
  const output =
    process.env.WRANGLER_OUTPUT_FILE_PATH ??
    join(
      process.env.WRANGLER_OUTPUT_FILE_DIRECTORY ?? directory,
      `wiki-preview-${Date.now()}.json`,
    );
  try {
    await mkdir(dirname(output), { recursive: true });
    const before = await readFile(output, "utf8").catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
      return "";
    });
    const code = await new Promise<number>((resolveExit, reject) => {
      const child = spawn(
        process.execPath,
        [
          resolve("node_modules/wrangler/bin/wrangler.js"),
          "preview",
          "--name",
          branch,
        ],
        {
          stdio: "inherit",
          env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: output },
        },
      );
      child.on("error", reject);
      child.on("exit", (code) => resolveExit(code ?? 1));
    });
    if (code !== 0) {
      process.exitCode = code;
      throw new Error(`Wrangler preview failed (${code})`);
    }
    const records = (await readFile(output, "utf8"))
      .slice(before.length)
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const previews = records.filter((record) => record.type === "preview");
    if (previews.length !== 1) {
      throw new Error("Expected one Preview deployment record");
    }
    await seedWiki(previewURL(previews[0], name, branch));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (import.meta.main) {
  deployAndSeed().catch((error) => {
    console.error(error);
    process.exitCode ||= 1;
  });
}
