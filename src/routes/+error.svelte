<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} — NostrCoWiki</title></svelte:head>
<h1>{page.status}</h1>
<p class="notice error" role="alert">
  {page.error?.message === "Not Found" || page.error?.message === "Not found"
    ? i18n.t("common.page_not_found")
    : page.error?.message === "Internal Error"
      ? i18n.t("common.something_went_wrong")
      : page.error?.message === "Article not found"
        ? i18n.t("common.article_not_found")
        : page.error?.message === "Historical content is unavailable"
          ? i18n.t("common.historical_content_is_unavailable")
          : page.error?.message === "Revision not found"
            ? i18n.t("common.revision_not_found")
            : (page.error?.message ?? i18n.t("common.something_went_wrong"))}
</p>
<a href={resolve("/")}>{i18n.t("common.return_to_the_wiki")}</a>
