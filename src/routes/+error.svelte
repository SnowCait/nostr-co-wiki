<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
</script>

<svelte:head><title>{page.status} — NostrCoWiki</title></svelte:head>
<p class="eyebrow">Unable to display this page</p>
<h1>{page.status}</h1>
<p class="notice error" role="alert">
  {page.error?.message ?? "Something went wrong."}
</p>
<a href={resolve("/")}>Return to the Wiki</a>
