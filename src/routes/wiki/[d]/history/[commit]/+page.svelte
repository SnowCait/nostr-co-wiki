<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import RenderedArticle from "#lib/components/RenderedArticle.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title
    >{m.revision_number({ number: tag(data.entry.commit, "seq") ?? "" })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>{m.revision_number({ number: tag(data.entry.commit, "seq") ?? "" })}</h2>
<p class="metadata">{date(data.entry.commit.created_at)}</p>
<nav class="revision-actions" aria-label={m.history()}>
  <a href={resolve("/wiki/[d]/history", { d: tag(data.article, "d")! })}
    >{m.all_revisions()}</a
  >{#if data.entry.revision}<a
      class="restore-action"
      href={resolve(`/wiki/[d]/edit?restore=${data.entry.commit.id}`, {
        d: tag(data.article, "d")!,
      })}>{m.prepare_restoration()}</a
    >{/if}
</nav>
{#if data.entry.revision}<p class="metadata">
    {m.restoration_opens_the_historical_content_in_the_editor_for_review_before_signing_a_new_revision()}
  </p>{/if}
{#if data.entry.revision}<p class="metadata">
    {m.editor()} <code>{data.entry.revision.pubkey}</code>
  </p>
  <p>{tag(data.entry.revision, "edit_summary") ?? m.no_edit_summary()}</p>

  <h2 class="section-label">
    {m.changes_from_the_preceding_revision()}
  </h2>
  {#if data.changes}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The translated, named region must be keyboard-scrollable.) -->
    <div
      class="diff"
      role="region"
      aria-label={m.revision_differences()}
      tabindex="0"
    >
      {#each data.changes as change, index (index)}<div
          class="diff-block"
          class:added={change.added}
          class:removed={change.removed}
        >
          <span class="sr-only"
            >{change.added
              ? m.added()
              : change.removed
                ? m.removed()
                : m.unchanged()}:
          </span><span class="diff-sign" aria-hidden="true"
            >{change.added ? "+" : change.removed ? "−" : " "}</span
          >
          <pre>{change.value}</pre>
        </div>{/each}
    </div>{:else}<p>
      {m.the_preceding_revision_is_unavailable_so_differences_cannot_be_computed()}
    </p>{/if}
  <section class="historical-document">
    <h2 class="section-label">{m.article_at_this_revision()}</h2>
    <article class="prose historical-content">
      <RenderedArticle html={data.html ?? ""} />
    </article>
  </section>{:else}<p>
    {m.historical_revision_unavailable_its_content_and_editor_signature_cannot_be_verified_from_the_commit_alone()}
  </p>{/if}
