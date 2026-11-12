<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import RenderedArticle from "#lib/components/RenderedArticle.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title
    >{i18n.t("common.revision_number", {
      number: Number(tag(data.entry.commit, "seq")),
    })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>
  {i18n.t("common.revision_number", {
    number: Number(tag(data.entry.commit, "seq")),
  })}
</h2>
<p class="metadata">{date(data.entry.commit.created_at, i18n.locale)}</p>
<nav class="revision-actions" aria-label={i18n.t("common.history")}>
  <a href={resolve("/wiki/[d]/history", { d: tag(data.article, "d")! })}
    >{i18n.t("common.all_revisions")}</a
  >{#if data.entry.revision}<a
      class="restore-action"
      href={resolve(`/wiki/[d]/edit?restore=${data.entry.commit.id}`, {
        d: tag(data.article, "d")!,
      })}>{i18n.t("common.prepare_restoration")}</a
    >{/if}
</nav>
{#if data.entry.revision}<p class="metadata">
    {i18n.t(
      "common.restoration_opens_the_historical_content_in_the_editor_for_review_before_signing_a_new_revision",
    )}
  </p>{/if}
{#if data.entry.revision}<p class="metadata">
    {i18n.t("common.editor")} <code>{data.entry.revision.pubkey}</code>
  </p>
  <p>
    {tag(data.entry.revision, "edit_summary") ??
      i18n.t("common.no_edit_summary")}
  </p>

  <h2 class="section-label">
    {i18n.t("common.changes_from_the_preceding_revision")}
  </h2>
  {#if data.changes}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The translated, named region must be keyboard-scrollable.) -->
    <div
      class="diff"
      role="region"
      aria-label={i18n.t("common.revision_differences")}
      tabindex="0"
    >
      {#each data.changes as change, index (index)}<div
          class="diff-block"
          class:added={change.added}
          class:removed={change.removed}
        >
          <span class="sr-only"
            >{change.added
              ? i18n.t("common.added")
              : change.removed
                ? i18n.t("common.removed")
                : i18n.t("common.unchanged")}:
          </span><span class="diff-sign" aria-hidden="true"
            >{change.added ? "+" : change.removed ? "−" : " "}</span
          >
          <pre>{change.value}</pre>
        </div>{/each}
    </div>{:else}<p>
      {i18n.t(
        "common.the_preceding_revision_is_unavailable_so_differences_cannot_be_computed",
      )}
    </p>{/if}
  <section class="historical-document">
    <h2 class="section-label">{i18n.t("common.article_at_this_revision")}</h2>
    <article class="prose historical-content">
      <RenderedArticle html={data.html ?? ""} />
    </article>
  </section>{:else}<p>
    {i18n.t(
      "common.historical_revision_unavailable_its_content_and_editor_signature_cannot_be_verified_from_the_commit_alone",
    )}
  </p>{/if}
