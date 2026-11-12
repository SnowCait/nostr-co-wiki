<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
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
  <small>{m.last_updated()} {date(data.article.created_at)}</small>
</p>
{#if updated}<p class="notice" role="status">
    {m.this_article_has_been_updated()}
    <button onclick={() => refreshAll()}>{m.show_latest_article()}</button>
  </p>{/if}
<article class="prose"><RenderedArticle html={data.html} /></article>
