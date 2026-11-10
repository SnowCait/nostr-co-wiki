<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { waitNostr } from "nip07-awaiter";
  let { data } = $props();
  let signingAvailable = $state(false);
  onMount(() => {
    const controller = new AbortController();
    waitNostr(0, { signal: controller.signal })
      .then((nostr) => {
        if (!controller.signal.aborted && nostr) {
          signingAvailable = true;
        }
      })
      .catch(() => {});
    return () => controller.abort();
  });
</script>

<h1>Wiki administration</h1>
{#if !signingAvailable}<p role="status">
    Waiting for a NIP-07 signing extension. Administrator requests require a
    signature.
  </p>{/if}
{#if data.adminBase}
  <a href={resolve("/admin/articles")}>Manage articles</a>
{:else}
  <!-- /articles is a host-mapped URL, not a SvelteKit route ID. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a href="/articles">Manage articles</a>
{/if}
