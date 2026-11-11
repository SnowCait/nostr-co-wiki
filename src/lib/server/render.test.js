import assert from "node:assert/strict";
import { test } from "node:test";
import { renderArticle } from "./render.ts";

test("sanitized Djot preserves safe links and removes XSS", () => {
  const html = renderArticle(
    '[Other][] [日本語][日本語 記事] [Bob][] [web][]\n\n[Bob]: nostr:npub1example\n[web]: https://example.com/\n\n[bad](javascript:alert%281%29)\n\n``` =html\n<script>attack()</script><img src="x" onerror="attack()"><a href="javascript:attack()">bad</a>\n```\n',
  );
  assert.match(html, /href="\/wiki\/other"/);
  assert.match(
    html,
    /href="\/wiki\/%E6%97%A5%E6%9C%AC%E8%AA%9E-%E8%A8%98%E4%BA%8B"/,
  );
  assert.match(html, /href="nostr:npub1example"/);
  assert.match(html, /href="https:\/\/example.com\/"/);
  assert.doesNotMatch(html, /<script|onerror=|href="javascript:/i);
});
