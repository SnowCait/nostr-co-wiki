import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizeEvent,
  getPublicKey,
  verifiedSymbol,
  verifyEvent,
} from "nostr-tools/pure";
import { matches, signedEvent } from "./protocol.ts";

const wikiKey = new Uint8Array(32).fill(1);
const editorKey = new Uint8Array(32).fill(2);
const wikiPubkey = getPublicKey(wikiKey);

function revision(
  d,
  base,
  content = "Article content",
  tags = [],
  key = editorKey,
) {
  return finalizeEvent(
    {
      kind: 2818,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [
        ["a", `30818:${wikiPubkey}:${d}`],
        ...(base ? [["e", base]] : []),
        ...tags,
      ],
    },
    key,
  );
}

test("protocol matching preserves zero time bounds and search constraints", () => {
  const zero = finalizeEvent(
    { kind: 30818, created_at: 0, content: "Nostr", tags: [] },
    editorKey,
  );
  const later = finalizeEvent(
    { kind: 30818, created_at: 1, content: "Nostr", tags: [] },
    editorKey,
  );
  const filter = {
    authors: [zero.pubkey],
    since: 0,
    until: 0,
    search: "nostr",
  };
  assert.equal(matches(zero, filter), true);
  assert.equal(matches(later, filter), false);
  assert.equal(matches(later, { since: 0, search: "nostr" }), true);
  assert.equal(matches(later, { since: 1, until: 1, search: "nostr" }), true);
  assert.equal(matches(later, { since: 2 }), false);
  assert.equal(matches(zero, { ...filter, authors: [wikiPubkey] }), false);
  assert.equal(matches(zero, { ...filter, search: "missing" }), false);
});

test("event validation rejects malformed fields and never trusts an incoming verification cache", () => {
  const valid = revision("validation");
  const input = { ...valid, extra: "ignored", [verifiedSymbol]: false };
  const accepted = signedEvent(input);
  assert.notEqual(accepted, input);
  assert.equal(verifyEvent(accepted), true);
  assert.deepEqual(Object.keys(accepted).sort(), [
    "content",
    "created_at",
    "id",
    "kind",
    "pubkey",
    "sig",
    "tags",
  ]);
  assert.throws(
    () => signedEvent({ ...valid, content: "tampered" }),
    /invalid: event ID or signature/,
  );
  for (const fields of [
    { kind: -1 },
    { kind: 2818.5 },
    { kind: 65536 },
    { created_at: -1 },
    { created_at: 0.5 },
    { created_at: Number.MAX_SAFE_INTEGER + 1 },
    { tags: [[]] },
    { tags: [["a", null]] },
    { tags: "invalid" },
    { content: 1 },
    { pubkey: 123 },
    { id: valid.id.toUpperCase() },
    { sig: "A".repeat(128) },
  ]) {
    assert.throws(
      () => signedEvent({ ...valid, ...fields }),
      /invalid: malformed event/,
    );
  }
});
