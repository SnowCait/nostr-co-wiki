<script lang="ts">
  import { use } from "#lib/i18n.ts";
  import LanguageSwitcher from "#lib/components/LanguageSwitcher.svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import "../style.css";
  let {
    children,
    data,
  }: { children: Snippet; data: import("./$types").LayoutData } = $props();
  const i18n = use(() => data);
  onMount(() => {
    const locale = document.cookie.match(/(?:^|;\s*)lang=(en|ja)(?:;|$)/)?.[1];
    if (locale) {
      document.cookie = `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  });
</script>

<div class:public-wiki={!data.administration}>
  {#if !data.administration}
    <a class="skip-link" href="#main-content"
      >{i18n.t("common.skip_to_content")}</a
    >
    <header class="site-header">
      <nav aria-label={i18n.t("common.main")}>
        <a class="wordmark" href={resolve("/")}>NostrCoWiki</a>
        {#if page.route.id !== "/" && page.route.id !== "/search"}<form
            class="header-search"
            action="/search"
            method="GET"
            role="search"
            aria-label={i18n.t("common.site_search")}
          >
            <label class="sr-only" for="header-search"
              >{i18n.t("common.search_the_wiki")}</label
            >
            <input
              id="header-search"
              name="q"
              type="search"
              placeholder={i18n.t("common.search_the_wiki")}
              required
            />
            <button>{i18n.t("common.search")}</button>
          </form>{/if}
        <a class="mobile-search" href={resolve("/search")}
          >{i18n.t("common.search")}</a
        >
        <a class="create-link" href={resolve("/new")}
          >{i18n.t("common.create_article")}</a
        >
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
      {i18n.t("common.a_collaboratively_edited_wiki_on_nostr")}
      <LanguageSwitcher />
    </footer>{:else}<footer>
      <span>NostrCoWiki</span>
      <p>{i18n.t("common.a_collaboratively_edited_wiki_on_nostr")}</p>
      <LanguageSwitcher />
    </footer>{/if}
</div>
