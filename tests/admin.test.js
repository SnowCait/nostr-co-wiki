import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createTestHarness } from "wrangler";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { getToken } from "nostr-tools/nip98";
import { nsecEncode, npubEncode } from "nostr-tools/nip19";
import { chromium } from "playwright";

const wikiKey = new Uint8Array(32).fill(11);
const adminKey = new Uint8Array(32).fill(12);
const editorKey = new Uint8Array(32).fill(13);
const pubkey = getPublicKey(wikiKey);
const sign = (event) => finalizeEvent(event, adminKey);

test(
  "administration authenticates requests, controls publication, and routes both host configurations",
  { timeout: 180000 },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "nostr-admin-"));
    const entry = join(dir, "web.js");
    await writeFile(
      entry,
      `import web from ${JSON.stringify(resolve("apps/web/.svelte-kit/cloudflare/_worker.js"))};
import relay from ${JSON.stringify(resolve("apps/relay/src/index.ts"))};
export default {fetch(request, env, ctx) {
 const url = new URL(request.url);
 if (url.pathname === '/__relay') { url.pathname = '/'; return relay.fetch(new Request(url, request), env); }
 return web.fetch(request, env, ctx);
}};`,
    );
    const web = JSON.parse(await readFile("apps/web/wrangler.json", "utf8"));
    const options = {
      workers: [
        {
          config: {
            ...web,
            main: entry,
            assets: {
              ...web.assets,
              directory: resolve("apps/web/.svelte-kit/cloudflare"),
            },
            vars: { RELAY_URL: "wss://relay.test/" },
          },
        },
        {
          secrets: { WIKI_PRIVATE_KEY: nsecEncode(wikiKey) },
          config: {
            ...JSON.parse(await readFile("apps/relay/wrangler.json", "utf8")),
            main: resolve("apps/relay/src/index.ts"),
            vars: { ADMIN_PUBLIC_KEY: npubEncode(getPublicKey(adminKey)) },
          },
        },
      ],
    };
    const server = createTestHarness(options);
    let browser;
    t.after(async () => {
      await browser?.close();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    });
    const { url } = await server.listen();
    const worker = () => server.getWorker("nostr-co-wiki-relay");
    const api = "https://relay.test/admin/articles";
    const auth = async (url = api, method = "GET", payload, signer = sign) =>
      getToken(url, method, signer, true, payload);
    const call = async (method = "GET", suffix = "", payload, authorization) =>
      worker().fetch(api + suffix, {
        method,
        headers: {
          Authorization:
            authorization ?? (await auth(api + suffix, method, payload)),
          "Content-Type": "application/json",
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    assert.equal((await worker().fetch(api)).status, 401);
    for (const token of [
      await auth(api, "POST"),
      await auth(api + "?wrong=1"),
      await auth(api, "GET", undefined, (event) =>
        finalizeEvent(event, editorKey),
      ),
      await auth(api, "GET", undefined, (event) =>
        sign({ ...event, created_at: 1 }),
      ),
      await auth(api, "GET", undefined, (event) =>
        sign({ ...event, created_at: Math.floor(Date.now() / 1000) + 120 }),
      ),
      await auth(api, "GET", undefined, (event) => ({
        ...sign(event),
        sig: "0".repeat(128),
      })),
      await auth(api, "GET", undefined, (event) => sign({ ...event, kind: 1 })),
    ]) {
      assert.equal((await call("GET", "", undefined, token)).status, 401);
    }
    const preflight = await worker().fetch(api, { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
    const socket = new WebSocket(url.origin.replace("http", "ws") + "/__relay");
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    const messages = [];
    socket.addEventListener("message", (event) =>
      messages.push(JSON.parse(event.data)),
    );
    const next = (predicate) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Missing Relay response")),
          5000,
        );
        const find = () => {
          const i = messages.findIndex(predicate);
          if (i >= 0) {
            clearTimeout(timer);
            socket.removeEventListener("message", find);
            resolve(messages.splice(i, 1)[0]);
          }
        };
        socket.addEventListener("message", find);
        find();
      });
    t.after(() => socket.close());
    const revision = (base) =>
      finalizeEvent(
        {
          kind: 2818,
          created_at: Math.floor(Date.now() / 1000),
          content: "Administration searchable content",
          tags: [
            ["a", `30818:${pubkey}:administration`],
            ["title", "Administration"],
            ...(base ? [["e", base]] : []),
          ],
        },
        editorKey,
      );
    const event = revision();
    socket.send(JSON.stringify(["EVENT", event]));
    assert.equal((await next((m) => m[0] === "OK"))[2], true);
    const db = await server
      .getWorker("nostr-co-wiki-relay")
      .getDurableObjectStorage("Wiki", { name: "wiki" });
    const before = await db.exec(
      "SELECT id FROM events WHERE kind IN (2818,3818) ORDER BY id",
    );
    const article = (await (await call()).json())[0];
    assert.equal(article.published, true);
    const head = article.article.tags.find((tag) => tag[0] === "head")[1];
    const query = async (filter) => {
      socket.send(JSON.stringify(["REQ", "check", filter]));
      await next((m) => m[0] === "EOSE" && m[1] === "check");
      const events = messages
        .filter((m) => m[0] === "EVENT" && m[1] === "check")
        .map((m) => m[2]);
      messages.splice(0);
      return events;
    };
    assert.equal((await query({ search: "Administration" })).length, 1);
    assert.equal(
      (
        await call(
          "PUT",
          "?d=administration",
          { published: false },
          await auth(api + "?d=administration", "PUT", { published: true }),
        )
      ).status,
      401,
    );
    assert.equal(
      (await call("PUT", "?d=administration", { published: false })).status,
      200,
    );
    assert.equal(
      (await (await call("GET", "?d=administration")).json()).article.content,
      event.content,
    );
    assert.equal(
      (await fetch(url.origin + "/wiki/administration")).status,
      404,
    );
    assert.equal((await query({})).length, 0);
    assert.equal((await query({ search: "Administration" })).length, 0);
    socket.send(JSON.stringify(["EVENT", revision(head)]));
    assert.equal((await next((m) => m[0] === "OK"))[2], false);
    assert.equal(
      (await call("PUT", "?d=administration", { published: true })).status,
      200,
    );
    assert.equal(
      (await fetch(url.origin + "/wiki/administration")).status,
      200,
    );
    assert.equal((await query({ search: "Administration" })).length, 1);
    assert.equal((await query({ kinds: [2818, 3818] })).length, 2);
    assert.deepEqual(
      await db.exec(
        "SELECT id FROM events WHERE kind IN (2818,3818) ORDER BY id",
      ),
      before,
    );
    for (const setting of [undefined, "invalid"]) {
      options.workers[1].config.vars = setting
        ? { ADMIN_PUBLIC_KEY: setting }
        : {};
      await server.update(options);
      assert.equal((await call()).status, 401);
    }
    options.workers[1].config.vars = {
      ADMIN_PUBLIC_KEY: npubEncode(getPublicKey(adminKey)),
    };
    await server.update(options);
    assert.equal((await fetch(url.origin + "/admin")).status, 200);
    assert.equal((await fetch(url.origin + "/admin/articles")).status, 200);
    assert.equal(
      (await server.fetch("http://example.workers.dev/admin")).status,
      200,
    );
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    const page = await browser.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(url.origin + "/admin");
    await page
      .getByText("Waiting for a NIP-07 signing extension.", { exact: false })
      .waitFor();
    await page.exposeFunction("signUnauthorized", (event) =>
      finalizeEvent(event, editorKey),
    );
    await page.exposeFunction("signAdmin", sign);
    await page.addInitScript(() => {
      globalThis.nostr = {
        getPublicKey: async () => "",
        signEvent: (event) => globalThis.signAdmin(event),
      };
    });
    let adminGetRequests = 0;
    await page.route("https://relay.test/**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        adminGetRequests++;
      }
      const response = await worker().fetch(req.url(), {
        method: req.method(),
        headers: req.headers(),
        body: req.postData() ?? undefined,
      });
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
    await page.goto(url.origin + "/admin/articles");
    await page.getByRole("button", { name: "Load articles" }).click();
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page.getByText("Article unpublished.", { exact: true }).waitFor();
    const getsBeforeView = adminGetRequests;
    await page.getByRole("button", { name: "View content" }).click();
    await page.getByText(event.content, { exact: true }).waitFor();
    assert.equal(adminGetRequests, getsBeforeView);
    await page.getByRole("button", { name: "Republish", exact: true }).click();
    await page.getByText("Article republished.", { exact: true }).waitFor();
    await page.evaluate(() => {
      globalThis.nostr.signEvent = (event) =>
        globalThis.signUnauthorized(event);
    });
    await page.getByRole("button", { name: "Load articles" }).click();
    await page
      .getByText("Administrator authentication failed or access was denied.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "View content" }).count(),
      0,
    );
    assert.deepEqual(failures, []);
    options.workers[0].config.vars.ADMIN_HOSTNAME = "admin.test";
    await server.update(options);
    for (const host of ["public.test", "example.workers.dev"]) {
      for (const path of ["/admin", "/admin/articles"]) {
        assert.equal((await server.fetch("http://" + host + path)).status, 404);
      }
    }
    assert.match(
      await (await server.fetch("http://admin.test/")).text(),
      /Wiki administration/,
    );
    assert.match(
      await (await server.fetch("http://admin.test/articles")).text(),
      /Manage articles/,
    );
    assert.equal((await server.fetch("http://public.test/")).status, 200);
  },
);
