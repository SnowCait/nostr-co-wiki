<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  let { d, current }: { d: string; current: "read" | "edit" | "history" } =
    $props();
</script>

<nav class="article-nav" aria-label={i18n.t("common.article")}>
  <a
    href={resolve("/wiki/[d]", { d })}
    aria-label={i18n.t("common.read_article")}
    aria-current={current === "read" ? "page" : undefined}
    >{i18n.t("common.read")}</a
  >
  <a
    href={resolve("/wiki/[d]/edit", { d })}
    aria-label={i18n.t("common.edit_article")}
    aria-current={current === "edit" ? "page" : undefined}
    >{i18n.t("common.edit")}</a
  >
  <a
    href={resolve("/wiki/[d]/history", { d })}
    aria-label={i18n.t("common.editing_history")}
    aria-current={current === "history" ? "page" : undefined}
    >{i18n.t("common.history")}</a
  >
</nav>
