import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
import { getPublicKey } from "nostr-tools/pure";
import { nsecEncode, npubEncode } from "nostr-tools/nip19";

test("localizes SSR, navigation and persistent language selection without changing URLs", async ({
  browser,
}) => {
  const admin = new Uint8Array(32).fill(44);
  const config = JSON.parse(await readFile("wrangler.json", "utf8"));
  const server = createTestHarness({
    workers: [
      {
        secrets: { WIKI_PRIVATE_KEY: nsecEncode(new Uint8Array(32).fill(41)) },
        config: {
          ...config,
          vars: {
            ...config.vars,
            ADMIN_PUBLIC_KEY: npubEncode(getPublicKey(admin)),
          },
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
    await Promise.all(
      [
        ["ja", "", "ja"],
        ["ja", "en", "en"],
        ["fr", "", "en"],
        ["ja", "invalid", "ja"],
        ["", "invalid", "en"],
      ].map(async ([language, cookie, expected]) => {
        const response = await fetch(url.origin, {
          headers: {
            "Accept-Language": language,
            ...(cookie ? { Cookie: `lang=${cookie}` } : {}),
          },
        });
        const html = await response.text();
        expect(html).toContain(`lang="${expected}"`);
        expect(html).toContain(
          expected === "ja" ? "Wiki を探索" : "Explore the Wiki",
        );
      }),
    );
    const context = await browser.newContext({
      locale: "ja-JP",
      viewport: { width: 1440, height: 900 },
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url.origin);
      await expect(
        page.getByRole("heading", { name: "Wiki を探索" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
      await page.goto(url.origin + "/new?draft=1#editor");
      await page.getByLabel("タイトル（必須）").fill("Draft title");
      await page.locator("#content").fill("Draft body");
      await page.locator("#summary").fill("Draft summary");
      await page.locator("#edit-summary").fill("Draft edit summary");
      const requests: string[] = [];
      page.on("request", (r) => {
        if (r.isNavigationRequest()) {
          requests.push(r.url());
        }
      });
      await page.evaluate(() => {
        (window as unknown as { marker: number }).marker = 42;
      });
      await page.getByLabel("表示言語").selectOption("en");
      await expect(page.getByLabel("Title (required)")).toHaveValue(
        "Draft title",
      );
      await expect(page.locator("#content")).toHaveValue("Draft body");
      await expect(page.locator("#summary")).toHaveValue("Draft summary");
      await expect(page.locator("#edit-summary")).toHaveValue(
        "Draft edit summary",
      );
      await expect(page).toHaveURL(url.origin + "/new?draft=1#editor");
      expect(requests).toEqual([]);
      expect(
        await page.evaluate(
          () => (window as unknown as { marker: number }).marker,
        ),
      ).toBe(42);
      await page.getByLabel("Language", { exact: true }).selectOption("ja");
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
      await page.goto(url.origin + "/admin");
      await expect(
        page.getByRole("heading", { name: "Wiki 管理" }),
      ).toBeVisible();
      await page.goto(url.origin + "/missing");
      await expect(
        page.getByText("ページが見つかりません", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  } finally {
    await server.close();
  }
});
