import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIdentifier } from "./identifier.ts";

test("NIP-54 normalization preserves identifiers", () => {
  for (const [title, expected] of [
    ["  Hello  World  ", "hello-world"],
    ["What's Up?", "whats-up"],
    ["日本語 Article", "日本語-article"],
    ["Ñoño", "ñoño"],
  ]) {
    assert.equal(normalizeIdentifier(title), expected);
  }
});
