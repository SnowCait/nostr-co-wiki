import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractParamsFactory } from "sveltekit-i18n";
import { date } from "./article.ts";

test("catalogues have the same keys and parser-defined interpolation parameters", async () => {
  const en = JSON.parse(
    await readFile(new URL("./translations/en/common.json", import.meta.url)),
  );
  const ja = JSON.parse(
    await readFile(new URL("./translations/ja/common.json", import.meta.url)),
  );
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  const extract = extractParamsFactory();
  for (const key of Object.keys(en)) {
    const params = (text) =>
      extract(text).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(params(en[key]), params(ja[key]), key);
  }
});
test("localized dates preserve UTC", () => {
  for (const locale of ["en", "ja"]) {
    const formatted = date(Date.UTC(2026, 0, 2, 3, 4, 5) / 1000, locale);
    assert.match(formatted, /03:04:05/);
    assert.match(formatted, /UTC/);
  }
});
