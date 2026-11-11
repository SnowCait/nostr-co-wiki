<script lang="ts">
  import { resolve } from "$app/paths";
  import ArticleList from "#lib/components/ArticleList.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>NostrCoWiki</title></svelte:head>
<div class="home-intro">
  <p class="eyebrow">A shared reference, open to everyone</p>
  <h1>NostrCoWiki</h1>
  <p class="lead">Read, write, and improve a shared Wiki.</p>
</div>
<form
  class="hero-search"
  aria-label="Article search"
  action="/search"
  method="GET"
  role="search"
>
  <label for="search">Search articles</label>
  <div class="row">
    <input id="search" name="q" type="search" required /><button>Search</button>
  </div>
</form>
<div class="section-heading">
  <h2>Recently updated articles</h2>
  <span class="eyebrow">Explore the Wiki</span>
</div>
{#if data.articles.length}<ArticleList
    articles={data.articles}
    showDate
  />{:else}<p class="empty-state">
    No published articles yet. <a href={resolve("/new")}
      >Create the first article</a
    >.
  </p>{/if}
