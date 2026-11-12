<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";
  import ArticleList from "#lib/components/ArticleList.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>NostrCoWiki</title></svelte:head>
<h1>{m.explore_the_wiki()}</h1>
<p class="lead">{m.read_write_and_improve_a_shared_wiki()}</p>
<form
  class="hero-search"
  aria-label={m.article_search()}
  action="/search"
  method="GET"
  role="search"
>
  <label for="search">{m.search_articles()}</label>
  <div class="row">
    <input id="search" name="q" type="search" required /><button
      >{m.search()}</button
    >
  </div>
</form>
<div class="section-heading">
  <h2>{m.recently_updated_articles()}</h2>
</div>
{#if data.articles.length}<ArticleList
    articles={data.articles}
    showDate
  />{:else}<p class="empty-state">
    {m.no_published_articles_yet()}
    <a href={resolve("/new")}>{m.create_the_first_article()}</a>.
  </p>{/if}
