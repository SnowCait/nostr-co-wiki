<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import ArticleList from "#lib/components/ArticleList.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>{i18n.t("common.search_nostrcowiki")}</title></svelte:head>
<h1>{i18n.t("common.search_articles")}</h1>
<form
  class="hero-search"
  aria-label={i18n.t("common.article_search")}
  action="/search"
  method="GET"
  role="search"
>
  <label for="q">{i18n.t("common.search_query")}</label>
  <div class="row">
    <input id="q" name="q" type="search" value={data.q} required /><button
      >{i18n.t("common.search")}</button
    >
  </div>
</form>
{#if data.failure}<p class="notice error" role="alert">
    {i18n.t("common.search_is_unavailable_please_try_again")}
  </p>{:else if !data.q}<p class="empty-state">
    {i18n.t("common.enter_a_search_query")}
  </p>{:else if [...data.q].length < 3}<p class="empty-state">
    {i18n.t("common.use_at_least_three_characters_to_search_articles")}
  </p>{:else}<h2>{i18n.t("common.search_results", { query: data.q })}</h2>
  {#if data.articles.length}<ArticleList articles={data.articles} />{:else}<p
      class="empty-state"
    >
      {i18n.t("common.no_articles_found")}
    </p>{/if}{/if}
