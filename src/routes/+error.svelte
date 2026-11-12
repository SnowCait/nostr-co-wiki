<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} — NostrCoWiki</title></svelte:head>
<h1>{page.status}</h1>
<p class="notice error" role="alert">
  {page.error?.message === "Not Found" || page.error?.message === "Not found"
    ? m.page_not_found()
    : page.error?.message === "Internal Error"
      ? m.something_went_wrong()
      : (page.error?.message ?? m.something_went_wrong())}
</p>
<a href={resolve("/")}>{m.return_to_the_wiki()}</a>
