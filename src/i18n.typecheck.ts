import { get } from "#lib/i18n.ts";
const i18n = get();
i18n.t("common.search");
i18n.t("common.search_results", { query: "Nostr" });
// @ts-expect-error Unknown keys must fail even on a clean install.
i18n.t("common.unknown_key");
// @ts-expect-error Required interpolation payload is missing.
i18n.t("common.search_results");
// @ts-expect-error Numeric interpolation rejects strings.
i18n.t("common.revision_number", { number: "one" });
