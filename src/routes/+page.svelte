<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  import ArticleList from "#lib/components/ArticleList.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>NostrCoWiki</title></svelte:head>
<h1>{i18n.t("common.explore_the_wiki")}</h1>
<p class="lead">{i18n.t("common.read_write_and_improve_a_shared_wiki")}</p>
<form
  class="hero-search"
  aria-label={i18n.t("common.article_search")}
  action="/search"
  method="GET"
  role="search"
>
  <label for="search">{i18n.t("common.search_articles")}</label>
  <div class="row">
    <input id="search" name="q" type="search" required /><button
      >{i18n.t("common.search")}</button
    >
  </div>
</form>
<div class="section-heading">
  <h2>{i18n.t("common.recently_updated_articles")}</h2>
</div>
{#if data.articles.length}<ArticleList
    articles={data.articles}
    showDate
  />{:else}<p class="empty-state">
    {i18n.t("common.no_published_articles_yet")}
    <a href={resolve("/new")}>{i18n.t("common.create_the_first_article")}</a>
  </p>{/if}
