<script lang="ts">
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import RenderedArticle from "#lib/components/RenderedArticle.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title>Revision {tag(data.entry.commit, "seq")} — NostrCoWiki</title
  ></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>Revision {tag(data.entry.commit, "seq")}</h2>
<p class="metadata">{date(data.entry.commit.created_at)}</p>
<nav class="revision-actions" aria-label="History">
  <a href={resolve("/wiki/[d]/history", { d: tag(data.article, "d")! })}
    >All revisions</a
  >{#if data.entry.revision}<a
      class="restore-action"
      href={resolve(`/wiki/[d]/edit?restore=${data.entry.commit.id}`, {
        d: tag(data.article, "d")!,
      })}>Prepare restoration</a
    >{/if}
</nav>
{#if data.entry.revision}<p class="metadata">
    Restoration opens the historical content in the editor for review before
    signing a new Revision.
  </p>{/if}
{#if data.entry.revision}<p class="metadata">
    Editor: <code>{data.entry.revision.pubkey}</code>
  </p>
  <p>{tag(data.entry.revision, "edit_summary") ?? "No edit summary"}</p>

  <h2 class="section-label">Changes from the preceding Revision</h2>
  {#if data.changes}<div
      class="diff"
      role="region"
      aria-label="Revision differences"
      tabindex="0"
    >
      {#each data.changes as change, index (index)}<div
          class="diff-block"
          class:added={change.added}
          class:removed={change.removed}
        >
          <span class="sr-only"
            >{change.added
              ? "Added"
              : change.removed
                ? "Removed"
                : "Unchanged"}:
          </span><span class="diff-sign" aria-hidden="true"
            >{change.added ? "+" : change.removed ? "−" : " "}</span
          >
          <pre>{change.value}</pre>
        </div>{/each}
    </div>{:else}<p>
      The preceding Revision is unavailable, so differences cannot be computed.
    </p>{/if}
  <section class="historical-document">
    <h2 class="section-label">Article at this Revision</h2>
    <article class="prose historical-content">
      <RenderedArticle html={data.html ?? ""} />
    </article>
  </section>{:else}<p>
    Historical Revision unavailable. Its content and editor signature cannot be
    verified from the Commit alone.
  </p>{/if}
