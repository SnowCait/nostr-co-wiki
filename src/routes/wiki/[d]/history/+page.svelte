<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title>{m.history_title({ title: title(data.article) })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>{m.article_history()}</h2>
<ol class="history">
  {#each data.history.toReversed() as entry (entry.commit.id)}<li>
      <a
        href={resolve("/wiki/[d]/history/[commit]", {
          d: tag(data.article, "d")!,
          commit: entry.commit.id,
        })}>{m.revision_number({ number: tag(entry.commit, "seq") ?? "" })}</a
      >
      <p class="metadata">{date(entry.commit.created_at)}</p>
      {#if entry.revision}<p class="edit-description">
          {tag(entry.revision, "edit_summary") ?? m.no_edit_summary()}
        </p>
        <details class="metadata">
          <summary>{m.editor()} {entry.revision.pubkey.slice(0, 12)}…</summary
          ><code>{entry.revision.pubkey}</code>
        </details>{:else}<p>
          {m.historical_revision_unavailable_its_content_and_editor_signature_cannot_be_verified()}
        </p>{/if}
    </li>{/each}
</ol>
