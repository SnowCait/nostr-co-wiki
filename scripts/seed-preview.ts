import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { createRevision, submitRevision } from "../src/lib/submission.ts";
import { normalizeIdentifier } from "../src/lib/identifier.ts";
import { tag, type ArticleResponse } from "../src/lib/article.ts";

export const samples = [
  {
    title: "Getting started",
    summary: "Explore this collaborative Wiki.",
    revisions: [
      "## Explore the Wiki\n\nRead articles and share knowledge.\n",
      "## Explore the Wiki\n\nA shared reference built with signed events.\n\n- Read articles\n- Share knowledge\n- Review editing history\n\nRead [日本語の記事][] and [Relay basics][].\n",
    ],
  },
  {
    title: "Relay basics",
    summary: "Revisions, Commits and Articles.",
    revisions: [
      "## How a Relay works\n\nEditors submit signed Revisions. The Wiki publishes accepted articles.\n\nStart with [Getting started][].\n",
    ],
  },
  {
    title: "日本語の記事",
    summary: "日本語の検索と表示を確認できます。",
    revisions: [
      "## 日本語の Wiki\n\n記事を読み、編集履歴や差分を確認できます。\n\n[Getting started][] も参照してください。\n",
    ],
  },
  {
    title:
      "A substantially longer article title that wraps across multiple lines on mobile",
    summary: "A long article for layout review.",
    revisions: [
      Array.from(
        { length: 8 },
        (_, i) =>
          `## Section ${i + 1}\n\nA collaboratively edited reference on Nostr. Read [Getting started][] to explore signed Revisions, linear history and restoration.\n`,
      ).join("\n"),
    ],
  },
];

async function readJSON(url: URL) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} at ${url.pathname}`);
  }
  return response.json();
}
async function waitFor<T>(
  action: () => Promise<T>,
  ready: (value: T) => boolean,
): Promise<T> {
  let failure: unknown;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const value = await action();
      if (ready(value)) {
        return value;
      }
    } catch (error) {
      failure = error;
    }
    if (attempt < 19) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Preview did not become ready", { cause: failure });
}
export async function seedWiki(origin: URL) {
  const metadata = await waitFor(
    () => readJSON(new URL("/api/wiki", origin)) as Promise<{ pubkey: string }>,
    (value) =>
      typeof value.pubkey === "string" && /^[a-f0-9]{64}$/.test(value.pubkey),
  );
  const key = generateSecretKey();
  const signer = {
    getPublicKey: async () => getPublicKey(key),
    signEvent: async (event: Parameters<typeof finalizeEvent>[0]) =>
      finalizeEvent(event, key),
  };
  const relay = new URL("/relay", origin);
  relay.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
  for (const sample of samples) {
    const d = normalizeIdentifier(sample.title);
    try {
      const articleURL = new URL("/api/article", origin);
      articleURL.searchParams.set("d", d);
      const state = (await readJSON(articleURL)) as ArticleResponse;
      if (state.status === "published" || state.status === "unpublished") {
        console.log(`Skipped ${d}: ${state.status}`);
        continue;
      }
      if (state.status !== "available") {
        throw new Error("Unknown article status");
      }
      let base: string | undefined;
      for (const content of sample.revisions) {
        const result = await submitRevision(
          signer,
          relay.href,
          createRevision({
            wikiPubkey: metadata.pubkey,
            d,
            title: sample.title,
            summary: sample.summary,
            editSummary: "Preview sample",
            content,
            base,
          }),
        );
        if (result.type !== "accepted") {
          throw new Error(`${result.type}: ${result.message}`);
        }
        articleURL.searchParams.set("revision", result.id!);
        const published = await waitFor(
          () => readJSON(articleURL) as Promise<ArticleResponse>,
          (value) =>
            value.status === "published" &&
            value.reflectsRevision &&
            !!value.article,
        );
        base = tag(published.article!, "head");
        if (!base) {
          throw new Error("Published article has no head Commit");
        }
      }
      console.log(`Created ${d}`);
    } catch (error) {
      throw new Error(`Seed failed for ${d}`, { cause: error });
    }
  }
}
