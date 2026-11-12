<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  import type { Event } from "nostr-tools/pure";
  import { tag, title, date } from "../article";
  let {
    articles,
    showDate = false,
  }: { articles: Event[]; showDate?: boolean } = $props();
</script>

<ul class="article-list">
  {#each articles as article (article.id)}
    <li>
      <a
        class="article-list-title"
        href={resolve("/wiki/[d]", { d: tag(article, "d")! })}
        >{title(article)}</a
      >
      {#if tag(article, "summary")}<p>{tag(article, "summary")}</p>{/if}
      {#if showDate}<small
          >{i18n.t("common.last_updated")}
          {date(article.created_at, i18n.locale)}</small
        >{/if}
    </li>
  {/each}
</ul>
