<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import RenderedArticle from "#lib/components/RenderedArticle.svelte";
  import { tag, title, date } from "#lib/article.ts";
  import { refreshAll } from "$app/navigation";
  import { subscribeArticle } from "#lib/article-updates.ts";
  let updated = $state(false);
  let { data }: import("./$types").PageProps = $props();
  $effect(() => {
    const article = data.article;
    updated = false;
    return subscribeArticle(
      data.relayUrl,
      article.pubkey,
      tag(article, "d")!,
      (received) => {
        if (received.id !== article.id) {
          updated = true;
        }
      },
    );
  });
</script>

<svelte:head
  ><title>{title(data.article)} — NostrCoWiki</title><meta
    name="description"
    content={tag(data.article, "summary") ?? ""}
  /></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="read" />
{#if tag(data.article, "summary")}<p class="summary">
    {tag(data.article, "summary")}
  </p>{/if}
<p class="metadata">
  <small
    >{i18n.t("common.last_updated")}
    {date(data.article.created_at, i18n.locale)}</small
  >
</p>
{#if updated}<p class="notice" role="status">
    {i18n.t("common.this_article_has_been_updated")}
    <button onclick={() => refreshAll()}
      >{i18n.t("common.show_latest_article")}</button
    >
  </p>{/if}
<article class="prose"><RenderedArticle html={data.html} /></article>
