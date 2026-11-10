import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { finalizeEvent } from "nostr-tools/pure";
import { nsecEncode } from "nostr-tools/nip19";

test(
  "npm run dev exposes both Workers, shares Wiki state, and shuts down on Ctrl+C",
  { timeout: 120000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "nostr-dev-"));
    let child;
    let stopped;
    let browser;
    let spawnError;
    t.after(async () => {
      try {
        await browser?.close();
        if (
          child &&
          child.exitCode === null &&
          child.signalCode === null &&
          !spawnError
        ) {
          process.kill(-child.pid, "SIGINT");
          await stopped;
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
    const filter = (path) =>
      !["node_modules", ".svelte-kit", ".wrangler"].includes(basename(path)) &&
      !/^\.(?:dev\.vars|env)(?:\.|$)/.test(basename(path));
    for (const path of [
      "apps",
      "packages",
      "scripts",
      "package.json",
      "package-lock.json",
    ]) {
      await cp(path, join(directory, path), { recursive: true, filter });
    }
    await symlink(
      resolve("node_modules"),
      join(directory, "node_modules"),
      "dir",
    );
    await writeFile(
      join(directory, "apps/relay/.dev.vars"),
      "WIKI_PRIVATE_KEY=" + nsecEncode(new Uint8Array(32).fill(9)) + "\n",
      { mode: 0o600 },
    );
    const config = JSON.parse(
      await readFile(join(directory, "apps/web/wrangler.json"), "utf8"),
    );
    assert.equal(config.vars?.RELAY_URL, undefined);
    let output = "";
    child = spawn("npm", ["run", "dev"], {
      cwd: directory,
      detached: true,
      env: {
        ...process.env,
        WRANGLER_REGISTRY_PATH: join(directory, "registry"),
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    stopped = new Promise((resolve) => {
      child.once("exit", resolve);
      child.once("error", (error) => {
        spawnError = error;
        resolve();
      });
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    let ready = false;
    for (let attempt = 0; attempt < 160; attempt++) {
      if (spawnError) {
        throw spawnError;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(output);
      }
      try {
        const response = await fetch("http://localhost:8787/new");
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* Wait for Wrangler to listen and connect its DO binding. */
      }
      await delay(250);
    }
    assert.ok(ready, output);
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    const page = await browser.newPage();
    let signed;
    const messages = [];
    await page.exposeFunction("signDevRevision", (event) => {
      signed = finalizeEvent(event, new Uint8Array(32).fill(8));
      return signed;
    });
    await page.addInitScript(() => {
      globalThis.nostr = {
        getPublicKey: async () => "",
        signEvent: (event) => globalThis.signDevRevision(event),
      };
    });
    page.on("websocket", (socket) => {
      assert.equal(socket.url(), "ws://localhost:8788/");
      socket.on("framereceived", (frame) => {
        messages.push(JSON.parse(String(frame.payload)));
      });
    });
    await page.goto("http://localhost:8787/new");
    await page.getByLabel("Title (required)").fill("Development connection");
    await page
      .getByLabel("Djot source")
      .fill("Shared Durable Object from the development Relay.");
    await page
      .getByText("This identifier is available.", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Sign and submit Revision" })
      .click();
    await page.waitForURL("http://localhost:8787/wiki/development-connection");
    assert.ok(
      messages.some(
        (message) =>
          message[0] === "OK" &&
          message[1] === signed.id &&
          message[2] === true,
      ),
    );
    const article = await (
      await fetch("http://localhost:8787/api/article?d=development-connection")
    ).json();
    assert.equal(article.article.content, signed.content);
    assert.match(
      await (
        await fetch("http://localhost:8787/wiki/development-connection")
      ).text(),
      /Shared Durable Object from the development Relay/,
    );
    await page.goto("http://localhost:8787/search?q=development");
    await page
      .getByRole("link", { name: "Development connection", exact: true })
      .waitFor();
    await browser.close();
    browser = undefined;
    process.kill(-child.pid, "SIGINT");
    await stopped;
    assert.equal(child.exitCode, 0, output);
    for (const port of [8787, 8788]) {
      await assert.rejects(fetch(`http://localhost:${port}/`));
    }
  },
);
