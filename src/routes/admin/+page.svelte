<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { waitNostr } from "nip07-awaiter";
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

<svelte:head
  ><title>{i18n.t("common.wiki_administration")} — NostrCoWiki</title
  ></svelte:head
>
<h1>{i18n.t("common.wiki_administration")}</h1>
{#if !signingAvailable}<p role="status">
    {i18n.t(
      "common.waiting_for_a_nip_07_signing_extension_administrator_requests_require_a_signature",
    )}
  </p>{/if}
<a href={resolve("/admin/articles")}>{i18n.t("common.manage_articles")}</a>
