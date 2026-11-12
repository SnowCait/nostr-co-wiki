<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import ArticleList from "#lib/components/ArticleList.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>{m.search_nostrcowiki()}</title></svelte:head>
<h1>{m.search_articles()}</h1>
<form
  class="hero-search"
  aria-label={m.article_search()}
  action="/search"
  method="GET"
  role="search"
>
  <label for="q">{m.search_query()}</label>
  <div class="row">
    <input id="q" name="q" type="search" value={data.q} required /><button
      >{m.search()}</button
    >
  </div>
</form>
{#if data.failure}<p class="notice error" role="alert">
    {data.failure}
  </p>{:else if !data.q}<p class="empty-state">
    {m.enter_a_search_query()}
  </p>{:else if [...data.q].length < 3}<p class="empty-state">
    {m.use_at_least_three_characters_to_search_articles()}
  </p>{:else}<h2>{m.search_results({ query: data.q })}</h2>
  {#if data.articles.length}<ArticleList articles={data.articles} />{:else}<p
      class="empty-state"
    >
      {m.no_articles_found()}
    </p>{/if}{/if}
