import { test } from "node:test";
import assert from "node:assert/strict";
import { previewURL, deployAndSeed } from "../../scripts/preview.ts";
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
  await assert.rejects(deployAndSeed(), /Preview command/);
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

test("propagates the Wrangler exit code and never starts seeding after a failed deployment", async (t) => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawn } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "preview-command-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "node_modules/wrangler/bin"), {
    recursive: true,
  });
  await writeFile(
    join(directory, "node_modules/wrangler/bin/wrangler.js"),
    'if (process.argv[2] !== "preview") process.exit(8); process.exit(7);',
  );
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [resolve("scripts/preview.ts")], {
      cwd: directory,
      env: { ...process.env, WORKERS_CI: "1", WORKERS_CI_BRANCH: "feature" },
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
  assert.equal(code, 7);
  const output = join(directory, "builds-output.json");
  const productionRecord = {
    ...record,
    preview_urls: ["https://nostr-co-wiki.example.workers.dev"],
  };
  await writeFile(
    join(directory, "node_modules/wrangler/bin/wrangler.js"),
    'require("node:fs").appendFileSync(process.env.WRANGLER_OUTPUT_FILE_PATH, ' +
      JSON.stringify(JSON.stringify(productionRecord) + "\n") +
      ");",
  );
  const guardedCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [resolve("scripts/preview.ts")], {
      cwd: directory,
      env: {
        ...process.env,
        WORKERS_CI: "1",
        WORKERS_CI_BRANCH: "feature",
        WRANGLER_OUTPUT_FILE_PATH: output,
      },
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
  assert.equal(guardedCode, 1);
  assert.deepEqual(
    JSON.parse(await readFile(output, "utf8")),
    productionRecord,
  );
});
