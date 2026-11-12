<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale, setLocale, isLocale } from "#lib/paraglide/runtime.js";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { onMount, type Snippet } from "svelte";
  import "../style.css";
  let {
    children,
    data,
  }: { children: Snippet; data: import("./$types").LayoutData } = $props();
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
  function changeLanguage(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement) || !isLocale(select.value)) {
      return;
    }
    if (
      select.value !== getLocale() &&
      document.querySelector("form.editor-form") &&
      !confirm(m.confirm_language_reload())
    ) {
      select.value = getLocale();
      return;
    }
    setLocale(select.value);
  }
</script>

{#snippet languages()}
  <div class="language-switcher">
    <label for="display-language">{m.language()}</label>
    <select
      id="display-language"
      disabled={!ready}
      value={getLocale()}
      onchange={changeLanguage}
    >
      <option value="en">English</option><option value="ja">日本語</option>
    </select>
  </div>
{/snippet}

<div class:public-wiki={!data.administration}>
  {#if !data.administration}
    <a class="skip-link" href="#main-content">{m.skip_to_content()}</a>
    <header class="site-header">
      <nav aria-label={m.main()}>
        <a class="wordmark" href={resolve("/")}>NostrCoWiki</a>
        {#if page.route.id !== "/" && page.route.id !== "/search"}<form
            class="header-search"
            action="/search"
            method="GET"
            role="search"
            aria-label={m.site_search()}
          >
            <label class="sr-only" for="header-search"
              >{m.search_the_wiki()}</label
            >
            <input
              id="header-search"
              name="q"
              type="search"
              placeholder={m.search_the_wiki()}
              required
            />
            <button>{m.search()}</button>
          </form>{/if}
        <a class="mobile-search" href={resolve("/search")}>{m.search()}</a>
        <a class="create-link" href={resolve("/new")}>{m.create_article()}</a>
      </nav>
    </header>
  {/if}
  <main
    id="main-content"
    tabindex="-1"
    class:reading={page.route.id === "/wiki/[d]"}
  >
    {@render children()}
  </main>
  {#if data.administration}<footer>
      {m.a_collaboratively_edited_wiki_on_nostr()}
      {@render languages()}
    </footer>{:else}<footer>
      <span>NostrCoWiki</span>
      <p>{m.a_collaboratively_edited_wiki_on_nostr()}</p>
      {@render languages()}
    </footer>{/if}
</div>
