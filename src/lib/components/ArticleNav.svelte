<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";
  let { d, current }: { d: string; current: "read" | "edit" | "history" } =
    $props();
</script>

<nav class="article-nav" aria-label={m.article()}>
  <a
    href={resolve("/wiki/[d]", { d })}
    aria-label={m.read_article()}
    aria-current={current === "read" ? "page" : undefined}>{m.read()}</a
  >
  <a
    href={resolve("/wiki/[d]/edit", { d })}
    aria-label={m.edit_article()}
    aria-current={current === "edit" ? "page" : undefined}>{m.edit()}</a
  >
  <a
    href={resolve("/wiki/[d]/history", { d })}
    aria-label={m.editing_history()}
    aria-current={current === "history" ? "page" : undefined}>{m.history()}</a
  >
</nav>
