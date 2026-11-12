import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
import {
  finalizeEvent,
  getPublicKey,
  type EventTemplate,
} from "nostr-tools/pure";
import { nsecEncode, npubEncode } from "nostr-tools/nip19";

test("localizes SSR, navigation and persistent language selection without changing URLs", async ({
  browser,
}, testInfo) => {
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
            ...(cookie ? { Cookie: `PARAGLIDE_LOCALE=${cookie}` } : {}),
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
      const headerHeight = await page
        .locator(".site-header")
        .evaluate((el) => el.getBoundingClientRect().height);
      await page.goto(url.origin + "/search?q=日本語#results");
      await page.getByLabel("表示言語").selectOption("en");
      await expect(
        page.getByRole("heading", { name: "Search articles", exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(url.origin + "/search?q=日本語#results");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByLabel("Language", { exact: true })).toBeEnabled();
      const documentRequests: string[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest()) {
          documentRequests.push(request.url());
        }
      });
      await page
        .getByRole("link", { name: "Create article", exact: true })
        .click();
      await page.getByLabel("Title (required)").fill("日本語の記事");
      expect(documentRequests).toEqual([]);
      await page
        .getByLabel("Summary (optional)", { exact: true })
        .fill("Draft summary");
      await page
        .getByLabel("Edit summary (optional)")
        .fill("Draft edit summary");
      await page
        .getByLabel("Djot source")
        .fill("User content remains unchanged");
      page.once("dialog", async (dialog) => {
        await dialog.dismiss();
      });
      await page.getByLabel("Language", { exact: true }).selectOption("ja");
      await expect(page.getByLabel("Title (required)")).toHaveValue(
        "日本語の記事",
      );
      await expect(page.getByLabel("Djot source")).toHaveValue(
        "User content remains unchanged",
      );
      await expect(
        page.getByLabel("Summary (optional)", { exact: true }),
      ).toHaveValue("Draft summary");
      await expect(page.getByLabel("Edit summary (optional)")).toHaveValue(
        "Draft edit summary",
      );
      expect(
        (await context.cookies()).find((c) => c.name === "PARAGLIDE_LOCALE")
          ?.value,
      ).toBe("en");
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await page.getByLabel("Language", { exact: true }).selectOption("ja");
      await expect(page.getByLabel("タイトル（必須）")).toBeVisible();
      const editor = new Uint8Array(32).fill(43);
      await page.exposeFunction("signForTest", async (event: EventTemplate) =>
        finalizeEvent(event, editor),
      );
      await context.addInitScript((pubkey) => {
        window.nostr = {
          getPublicKey: async () => pubkey,
          signEvent: (event) => globalThis.signForTest(event),
        };
      }, getPublicKey(editor));
      await page.reload();
      await page.getByLabel("タイトル（必須）").fill("日本語の利用者記事");
      await page
        .getByLabel("Djot ソース")
        .fill("User content remains unchanged");
      await page
        .getByLabel("記事概要（任意）", { exact: true })
        .fill("Original summary");
      await page.getByLabel("編集概要（任意）").fill("Original edit summary");
      await expect(
        page.getByRole("button", { name: "署名して Revision を投稿" }),
      ).toBeEnabled();
      await page.evaluate(() => {
        window.nostr.signEvent = async () => {
          throw new Error("declined");
        };
      });
      await page
        .getByRole("button", { name: "署名して Revision を投稿" })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "署名が拒否" }),
      ).toBeVisible();
      await expect(page.getByLabel("Djot ソース")).toHaveValue(
        "User content remains unchanged",
      );
      expect(
        Math.abs(
          (await page
            .locator(".site-header")
            .evaluate((el) => el.getBoundingClientRect().height)) -
            headerHeight,
        ),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath("japanese-editor-desktop.png"),
        fullPage: true,
      });
      await page.evaluate(() => {
        window.nostr.signEvent = (event) => globalThis.signForTest(event);
      });
      await page
        .getByRole("button", { name: "署名して Revision を投稿" })
        .click();
      await expect(
        page.getByRole("heading", { name: "日本語の利用者記事", exact: true }),
      ).toBeVisible();
      await expect(page.locator("article.prose")).toContainText(
        "User content remains unchanged",
      );
      await expect(page.locator(".summary")).toHaveText("Original summary");
      await expect(page.locator(".metadata")).toContainText("UTC");
      await page.getByRole("link", { name: "編集履歴", exact: true }).click();
      await expect(page.locator(".history")).toContainText(
        "Original edit summary",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: testInfo.outputPath("japanese-history-mobile.png"),
        fullPage: true,
      });
      await page.getByRole("link", { name: "第1版", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "直前の版からの変更" }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("japanese-revision-mobile.png"),
        fullPage: true,
      });
      await page.getByRole("link", { name: "復元内容を確認" }).click();
      await expect(page.getByLabel("Djot ソース")).toHaveValue(
        "User content remains unchanged",
      );
      await expect(
        page.locator(".notice").filter({ hasText: "署名前に下書きを確認" }),
      ).toBeVisible();
      await page.goto(url.origin + "/search?q=unchanged");
      await expect(
        page.getByRole("heading", { name: "「unchanged」の検索結果" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "日本語の利用者記事", exact: true }),
      ).toBeVisible();
      await page.goto(url.origin + "/admin");
      await expect(
        page.getByRole("heading", { name: "Wiki 管理" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "記事を管理" }).click();
      await page.getByRole("button", { name: "記事一覧を取得" }).click();
      await expect(page.getByRole("status")).toContainText("管理者認証に失敗");
      await page.exposeFunction("signAdmin", async (event: EventTemplate) =>
        finalizeEvent(event, admin),
      );
      await page.evaluate((pubkey) => {
        window.nostr.getPublicKey = async () => pubkey;
        window.nostr.signEvent = (event) => globalThis.signAdmin(event);
      }, getPublicKey(admin));
      await page.getByRole("button", { name: "記事一覧を取得" }).click();
      await expect(
        page.getByRole("heading", { name: "日本語の利用者記事" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "非公開にする", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText(
        "記事を非公開にしました。",
      );
      await page
        .getByRole("button", { name: "再公開する", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText(
        "記事を再公開しました。",
      );
      await page.screenshot({
        path: testInfo.outputPath("japanese-admin-mobile.png"),
        fullPage: true,
      });
      await page.goto(url.origin + "/wiki/no-such-article");
      await expect(page.getByRole("alert")).toContainText(
        "記事が見つかりません",
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  } finally {
    await server.close();
  }
});
