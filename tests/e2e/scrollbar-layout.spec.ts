import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { nsecEncode } from "nostr-tools/nip19";
import { createRevision, submitRevision } from "../../src/lib/submission.ts";

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
});

test("keeps public pages aligned with a space-consuming scrollbar", async ({
  page,
}) => {
  const wikiKey = new Uint8Array(32).fill(31);
  const authorKey = new Uint8Array(32).fill(32);
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
        },
      },
    ],
  });
  try {
    const { url } = await server.listen();
    const base = url.origin;
    const relay = base.replace(/^http/, "ws") + "/relay";
    const result = await submitRevision(
      {
        getPublicKey: async () => getPublicKey(authorKey),
        signEvent: async (event) => finalizeEvent(event, authorKey),
      },
      relay,
      createRevision({
        wikiPubkey: getPublicKey(wikiKey),
        d: "scrollbar-test",
        title: "Scrollbar test",
        content: "Short article",
        summary: "",
        editSummary: "",
      }),
    );
    expect(result.type).toBe("accepted");
    const measurements = [];
    for (const [path, heading] of [
      ["/", "Explore the Wiki"],
      ["/search?q=missing-xyz", "Search articles"],
      ["/wiki/scrollbar-test", "Scrollbar test"],
      ["/wiki/scrollbar-test/edit", "Scrollbar test"],
      ["/wiki/scrollbar-test/history", "Scrollbar test"],
    ]) {
      await page.goto(base + path);
      await expect(
        page.getByRole("heading", { name: heading, level: 1 }),
      ).toBeVisible();
      const measure = await page.evaluate(() => ({
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        site: document.querySelector(".wordmark")!.getBoundingClientRect().left,
        main: document.querySelector("main")!.getBoundingClientRect().left,
      }));
      console.log(path, JSON.stringify(measure));
      measurements.push(measure);
    }
    expect(measurements.some((m) => m.scrollHeight <= m.viewportHeight)).toBe(
      true,
    );
    expect(
      measurements.some(
        (m) =>
          m.scrollHeight > m.viewportHeight && m.clientWidth < m.innerWidth,
      ),
    ).toBe(true);
    for (const m of measurements) {
      expect(Math.abs(m.site - measurements[0].site)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.main - measurements[0].main)).toBeLessThanOrEqual(1);
    }
  } finally {
    await server.close();
  }
});
