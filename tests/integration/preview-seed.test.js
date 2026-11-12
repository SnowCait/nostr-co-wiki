import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewURL,
  seedDeployedPreview,
  readPreviewOutput,
} from "../../scripts/preview.ts";
import { seedWiki } from "../../scripts/seed-preview.ts";
const record = {
  type: "preview",
  version: 1,
  worker_name: "nostr-co-wiki",
  preview_name: "feature",
  preview_id: "preview-id",
  deployment_id: "deploy-id",
  preview_slug: "feature",
  preview_urls: ["https://feature-nostr-co-wiki.example.workers.dev"],
};
test("accepts only a structured result for the expected Worker and Preview", () => {
  assert.equal(
    previewURL(record, "nostr-co-wiki", "feature").hostname,
    "feature-nostr-co-wiki.example.workers.dev",
  );
  for (const changes of [
    { type: "deploy" },
    { version: 2 },
    { worker_name: "other" },
    { preview_name: "main" },
    { preview_slug: "" },
    { preview_urls: ["https://nostr-co-wiki.example.workers.dev"] },
    { preview_urls: ["https://external.example"] },
    { preview_urls: ["http://feature-nostr-co-wiki.example.workers.dev"] },
  ]) {
    assert.throws(() =>
      previewURL({ ...record, ...changes }, "nostr-co-wiki", "feature"),
    );
  }
});
test("does not deploy outside Workers Builds", async () => {
  assert.notEqual(process.env.WORKERS_CI, "1");
  await assert.rejects(seedDeployedPreview(), /Preview command/);
});
test("does not interpret a failed or unknown article lookup as available", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const response of [
    new Response("failure", { status: 503 }),
    Response.json({ status: "unknown" }),
  ]) {
    globalThis.fetch = async (url) =>
      new URL(url).pathname === "/api/wiki"
        ? Response.json({ pubkey: "1".repeat(64) })
        : response;
    await assert.rejects(seedWiki(new URL("http://localhost")), /Seed failed/);
  }
});

test("reports connection failures and relay rejection separately", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalSocket;
  });
  globalThis.fetch = async (url) =>
    Response.json(
      new URL(url).pathname === "/api/wiki"
        ? { pubkey: "1".repeat(64) }
        : { status: "available" },
    );
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("offline");
    }
  };
  await assert.rejects(seedWiki(new URL("http://localhost")), (error) =>
    error.cause.message.startsWith("connection:"),
  );
  globalThis.WebSocket = class {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 1;
    listeners = {};
    addEventListener(type, listener) {
      this.listeners[type] = listener;
      if (type === "open") {
        queueMicrotask(listener);
      }
    }
    send(data) {
      const [, event] = JSON.parse(data);
      this.listeners.message({
        data: JSON.stringify(["OK", event.id, false, "blocked: rejected"]),
      });
    }
    close() {
      this.readyState = 3;
    }
  };
  await assert.rejects(
    seedWiki(new URL("http://localhost")),
    (error) => error.cause.message === "rejected: blocked: rejected",
  );
});

test("reads the latest Wrangler output without accepting stale or ambiguous results", async (t) => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "preview-output-"));
  const original = { ...process.env };
  t.after(async () => {
    process.env = original;
    await rm(directory, { recursive: true, force: true });
  });
  delete process.env.WRANGLER_OUTPUT_FILE_PATH;
  process.env.WRANGLER_OUTPUT_FILE_DIRECTORY = directory;
  const old = join(
    directory,
    "wrangler-output-2026-11-10_12-00-00_000-aabbcc.json",
  );
  const current = join(
    directory,
    "wrangler-output-2026-11-11_12-00-00_000-ddeeff.json",
  );
  const session = { type: "wrangler-session" };
  const lines = (...entries) =>
    entries.map((entry) => JSON.stringify(entry)).join("\n");
  await writeFile(join(directory, "unrelated.json"), lines(session, record));
  await assert.rejects(
    readPreviewOutput("nostr-co-wiki", "feature"),
    /Cannot uniquely/,
  );
  await writeFile(old, lines(session, record));
  await writeFile(
    current,
    lines(session, { ...record, preview_name: "other" }),
  );
  await assert.rejects(
    readPreviewOutput("nostr-co-wiki", "feature"),
    /Unrecognized/,
  );
  await writeFile(current, lines(session, record));
  assert.equal(
    (await readPreviewOutput("nostr-co-wiki", "feature")).href,
    record.preview_urls[0] + "/",
  );
  const duplicate = join(
    directory,
    "wrangler-output-2026-11-11_12-00-00_000-112233.json",
  );
  await writeFile(duplicate, lines(session, record));
  await assert.rejects(
    readPreviewOutput("nostr-co-wiki", "feature"),
    /Cannot uniquely/,
  );
  process.env.WRANGLER_OUTPUT_FILE_PATH = current;
  await writeFile(current, lines(session, record, session));
  await assert.rejects(
    readPreviewOutput("nostr-co-wiki", "feature"),
    /found 0/,
  );
  await writeFile(current, lines(session, record, session, record));
  assert.equal(
    (await readPreviewOutput("nostr-co-wiki", "feature")).href,
    record.preview_urls[0] + "/",
  );
  await writeFile(
    current,
    lines(session, {
      ...record,
      preview_urls: ["https://nostr-co-wiki.example.workers.dev"],
    }),
  );
  await assert.rejects(
    readPreviewOutput("nostr-co-wiki", "feature"),
    /No verified/,
  );
  process.env.WRANGLER_OUTPUT_FILE_PATH = join(directory, "missing.json");
  await assert.rejects(readPreviewOutput("nostr-co-wiki", "feature"), {
    code: "ENOENT",
  });
});

test("the preview command stops before seeding when Wrangler fails", async (t) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawn } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "preview-command-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "node_modules/.bin"), { recursive: true });
  await writeFile(
    join(directory, "node_modules/.bin/wrangler"),
    "#!/bin/sh\nexit 7\n",
    { mode: 0o755 },
  );
  const { scripts } = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(resolve("package.json"), "utf8"),
  );
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ scripts: { preview: scripts.preview } }),
  );
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn("npm", ["run", "preview"], {
      cwd: directory,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
  assert.equal(code, 7);
});
