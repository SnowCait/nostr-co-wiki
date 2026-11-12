import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { date } from "./article.ts";
import { getLocale, overwriteGetLocale } from "./paraglide/runtime.js";

test("UI catalogs contain matching messages and interpolation parameters", async () => {
  const en = JSON.parse(
    await readFile(new URL("../../messages/en.json", import.meta.url)),
  );
  const ja = JSON.parse(
    await readFile(new URL("../../messages/ja.json", import.meta.url)),
  );
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  for (const key of Object.keys(en)) {
    assert.ok(en[key].trim(), key);
    assert.ok(ja[key].trim(), key);
    const parameters = (value) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(parameters(en[key]), parameters(ja[key]), key);
  }
});

test("dates follow the display locale while preserving UTC", () => {
  const previous = getLocale;
  try {
    for (const locale of ["en", "ja"]) {
      overwriteGetLocale(() => locale);
      assert.equal(
        date(0),
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "long",
          timeZone: "UTC",
        }).format(new Date(0)),
      );
      assert.match(date(0), /UTC/);
    }
  } finally {
    overwriteGetLocale(previous);
  }
});
