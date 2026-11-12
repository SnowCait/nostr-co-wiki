<script lang="ts">
  import { resolve } from "$app/paths";
  let { d, current }: { d: string; current: "read" | "edit" | "history" } =
    $props();
</script>

<nav class="article-nav" aria-label="Article">
  <a
    href={resolve("/wiki/[d]", { d })}
    aria-label="Read article"
    aria-current={current === "read" ? "page" : undefined}>Read</a
  >
  <a
    href={resolve("/wiki/[d]/edit", { d })}
    aria-label="Edit article"
    aria-current={current === "edit" ? "page" : undefined}>Edit</a
  >
  <a
    href={resolve("/wiki/[d]/history", { d })}
    aria-label="Editing history"
    aria-current={current === "history" ? "page" : undefined}>History</a
  >
</nav>
