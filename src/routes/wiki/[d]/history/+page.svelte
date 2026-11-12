<script lang="ts">
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title>History of {title(data.article)} — NostrCoWiki</title></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>Article history</h2>
<ol class="history">
  {#each data.history.toReversed() as entry (entry.commit.id)}<li>
      <a
        href={resolve("/wiki/[d]/history/[commit]", {
          d: tag(data.article, "d")!,
          commit: entry.commit.id,
        })}>Revision {tag(entry.commit, "seq")}</a
      >
      <p class="metadata">{date(entry.commit.created_at)}</p>
      {#if entry.revision}<p class="edit-description">
          {tag(entry.revision, "edit_summary") ?? "No edit summary"}
        </p>
        <details class="metadata">
          <summary>Editor: {entry.revision.pubkey.slice(0, 12)}…</summary><code
            >{entry.revision.pubkey}</code
          >
        </details>{:else}<p>
          Historical Revision unavailable; its content and editor signature
          cannot be verified.
        </p>{/if}
    </li>{/each}
</ol>
