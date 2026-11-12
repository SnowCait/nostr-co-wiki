<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import "../style.css";
  let {
    children,
    data,
  }: { children: Snippet; data: import("./$types").LayoutData } = $props();
</script>

<div class:public-wiki={!data.administration}>
  {#if !data.administration}
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <nav aria-label="Main">
        <a class="wordmark" href={resolve("/")}
          >NostrCoWiki<span>An open encyclopedia</span></a
        >
        <form
          class="header-search"
          action="/search"
          method="GET"
          role="search"
          aria-label="Site search"
        >
          <label class="sr-only" for="header-search">Search the Wiki</label>
          <input
            id="header-search"
            name="q"
            type="search"
            placeholder="Search the Wiki"
            required
          />
          <button>Search</button>
        </form>
        <a class="create-link" href={resolve("/new")}>Create article</a>
      </nav>
    </header>
  {/if}
  <main
    id="main-content"
    tabindex="-1"
    class:wide={page.route.id === "/new" || page.route.id?.endsWith("/edit")}
    class:reading={page.route.id === "/wiki/[d]"}
  >
    {@render children()}
  </main>
  {#if data.administration}<footer>
      A collaboratively edited Wiki on Nostr.
    </footer>{:else}<footer>
      <span>NostrCoWiki</span>
      <p>A collaboratively edited Wiki on Nostr.</p>
    </footer>{/if}
</div>
