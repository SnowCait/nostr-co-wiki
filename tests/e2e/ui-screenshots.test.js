import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createTestHarness } from "wrangler";
import { chromium } from "playwright";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { nsecEncode, npubEncode } from "nostr-tools/nip19";
import { getToken } from "nostr-tools/nip98";
import { createRevision, submitRevision } from "../../src/lib/submission.ts";

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

test(
  "capture major Wiki screens at desktop and mobile sizes",
  { timeout: 180000 },
  async (t) => {
    const directory = resolve("artifacts/ui-screenshots");
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    const wikiKey = new Uint8Array(32).fill(21);
    const adminKey = new Uint8Array(32).fill(22);
    const editorKey = new Uint8Array(32).fill(23);
    const config = JSON.parse(await readFile("wrangler.json", "utf8"));
    const server = createTestHarness({
      workers: [
        {
          secrets: { WIKI_PRIVATE_KEY: nsecEncode(wikiKey) },
          config: {
            ...config,
            main: resolve("worker.js"),
            assets: {
              ...config.assets,
              directory: resolve(".svelte-kit/cloudflare"),
            },
            vars: { ADMIN_PUBLIC_KEY: npubEncode(getPublicKey(adminKey)) },
          },
        },
      ],
    });
    let browser;
    t.after(async () => {
      await browser?.close();
      await server.close();
    });
    const { url } = await server.listen();
    const base = url.origin;
    const relay = base.replace(/^http/, "ws") + "/relay";
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    const screenshot = (page, state, viewport) =>
      page.screenshot({
        path: join(directory, `${state}-${viewport.name}.png`),
        fullPage: true,
      });

    // Capture both empty home pages before populating the isolated Wiki.
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await page.goto(base);
      await page
        .getByText("No published articles yet.", { exact: false })
        .waitFor();
      await screenshot(page, "home-empty", viewport);
      await page.close();
    }

    const publish = async (d, title, content, summary, editSummary, base) => {
      const result = await submitRevision(
        {
          getPublicKey: async () => getPublicKey(editorKey),
          signEvent: async (event) => finalizeEvent(event, editorKey),
        },
        relay,
        createRevision({
          d,
          title,
          content,
          summary,
          editSummary,
          base,
          wikiPubkey: getPublicKey(wikiKey),
        }),
      );
      assert.equal(result.type, "accepted", result.message);
      return (await (await fetch(`${url.origin}/api/article?d=${d}`)).json())
        .article;
    };
    const head = (article) => article.tags.find((tag) => tag[0] === "head")[1];
    const first = await publish(
      "getting-started",
      "Getting started",
      "## Explore the Wiki\n\nNostr connects people through signed events.\n\n- Read articles\n- Share knowledge\n",
      "An introduction to collaborative editing on Nostr.",
      "Create the introduction",
    );
    const second = await publish(
      "getting-started",
      "Getting started",
      "## Explore the Wiki\n\nA shared reference built with signed events.\n\n- Read articles\n- Share knowledge\n- Review editing history\n",
      "An introduction to collaborative editing on Nostr.",
      "Clarify the introduction and add history",
      head(first),
    );
    const currentContent =
      second.content +
      "\nRead [Relay basics][] to learn how updates are distributed.\n\n日本語の記事も作成できます。\n";
    await publish(
      "getting-started",
      "Getting started",
      currentContent,
      "An introduction to collaborative editing on Nostr.",
      "Link the Relay guide",
      head(second),
    );
    await publish(
      "relay-basics",
      "Relay basics",
      "## How a Relay works\n\nEditors submit signed Revisions. The Wiki publishes accepted articles.\n",
      "Understand Revisions, Commits, and Article distribution.",
      "Create the Relay guide",
    );
    await publish(
      "private-notes",
      "Private notes",
      "Unpublished test notes for the administration screenshots.",
      "Test data visible only to the administrator.",
      "Create private notes",
    );
    const adminUrl = base + "/api/admin/articles?d=private-notes";
    const payload = { published: false };
    const hidden = await server.getWorker("nostr-co-wiki").fetch(adminUrl, {
      method: "PUT",
      headers: {
        Authorization: await getToken(
          adminUrl,
          "PUT",
          (event) => finalizeEvent(event, adminKey),
          true,
          payload,
        ),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    assert.equal(hidden.status, 200, await hidden.text());

    for (const viewport of viewports) {
      await t.test(viewport.name, async (st) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          extraHTTPHeaders: { "CF-Connecting-IP": "203.0.113.42" },
        });
        st.after(() => context.close());
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.exposeFunction("signScreenshotRequest", (event) =>
          finalizeEvent(event, adminKey),
        );
        await page.addInitScript(() => {
          globalThis.nostr = {
            getPublicKey: async () => "",
            signEvent: (event) => globalThis.signScreenshotRequest(event),
          };
        });
        await page.goto(base);
        await page
          .getByRole("link", { name: "Getting started", exact: true })
          .waitFor();
        await page
          .getByRole("link", { name: "Relay basics", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("link", { name: "Private notes", exact: true })
            .count(),
          0,
        );
        await screenshot(page, "home-populated", viewport);

        await page.goto(base + "/search?q=relay");
        await page
          .getByRole("link", { name: "Relay basics", exact: true })
          .waitFor();
        await screenshot(page, "search-results", viewport);
        await page.goto(base + "/search?q=missing-article-xyz");
        await page.getByText("No articles found.", { exact: true }).waitFor();
        await screenshot(page, "search-empty", viewport);

        await page.goto(base + "/wiki/getting-started");
        await page
          .getByRole("heading", { name: "Explore the Wiki", exact: true })
          .waitFor();
        await screenshot(page, "article-published", viewport);

        await page.goto(base + "/new");
        await page.getByLabel("Title (required)").fill("Draft article");
        await page
          .getByLabel("Djot source")
          .fill(
            "## Draft preview\n\nA **collaborative** article with a [Getting started][] link.\n\n- Write in Djot\n- Preview before signing\n",
          );
        await page
          .getByLabel("Summary (optional)", { exact: true })
          .fill("A draft ready for review.");
        await page
          .getByLabel("Edit summary (optional)")
          .fill("Write the first draft");
        await page
          .getByText("This identifier is available.", { exact: false })
          .waitFor();
        await page
          .getByRole("heading", { name: "Draft preview", exact: true })
          .waitFor();
        await page
          .getByText("Waiting for a NIP-07", { exact: false })
          .waitFor({ state: "hidden" });
        await screenshot(page, "article-create-preview", viewport);

        await page.goto(base + "/wiki/getting-started/edit");
        assert.equal(
          await page.getByLabel("Djot source").inputValue(),
          currentContent,
        );
        await page
          .getByRole("heading", { name: "Explore the Wiki", exact: true })
          .waitFor();
        await page
          .getByText("Waiting for a NIP-07", { exact: false })
          .waitFor({ state: "hidden" });
        await screenshot(page, "article-edit-loaded", viewport);

        await page.goto(base + "/wiki/getting-started/history");
        await page
          .getByRole("link", { name: "Revision 3", exact: true })
          .waitFor();
        await screenshot(page, "history-revisions", viewport);
        await page.goto(base + "/wiki/getting-started/history/" + head(second));
        await page.locator(".diff .added").first().waitFor();
        await page.locator(".diff .removed").first().waitFor();
        await screenshot(page, "history-detail-diff", viewport);

        await page.goto(base + "/admin");
        await page
          .getByRole("heading", { name: "Wiki administration", exact: true })
          .waitFor();
        await page
          .getByText("Waiting for a NIP-07", { exact: false })
          .waitFor({ state: "hidden" });
        await screenshot(page, "admin-initial", viewport);
        await page
          .getByRole("link", { name: "Manage articles", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Load articles", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Private notes", exact: true })
          .waitFor();
        await page.getByText("Unpublished", { exact: true }).waitFor();
        await page.getByText("Published", { exact: true }).first().waitFor();
        await page
          .locator("button:not([disabled])")
          .filter({ hasText: "Load articles" })
          .waitFor();
        await screenshot(page, "admin-articles-loaded", viewport);
        assert.deepEqual(errors, []);
      });
    }
  },
);
