<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import { resolve } from "$app/paths";
  import { tag, title, date } from "#lib/article.ts";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title
    >{i18n.t("common.history_title", { title: title(data.article) })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{title(data.article)}</h1>
<ArticleNav d={tag(data.article, "d")!} current="history" />
<h2>{i18n.t("common.article_history")}</h2>
<ol class="history">
  {#each data.history.toReversed() as entry (entry.commit.id)}<li>
      <a
        href={resolve("/wiki/[d]/history/[commit]", {
          d: tag(data.article, "d")!,
          commit: entry.commit.id,
        })}
        >{i18n.t("common.revision_number", {
          number: Number(tag(entry.commit, "seq")),
        })}</a
      >
      <p class="metadata">{date(entry.commit.created_at, i18n.locale)}</p>
      {#if entry.revision}<p class="edit-description">
          {tag(entry.revision, "edit_summary") ??
            i18n.t("common.no_edit_summary")}
        </p>
        <details class="metadata">
          <summary
            >{i18n.t("common.editor")}
            {entry.revision.pubkey.slice(0, 12)}…</summary
          ><code>{entry.revision.pubkey}</code>
        </details>{:else}<p>
          {i18n.t(
            "common.historical_revision_unavailable_its_content_and_editor_signature_cannot_be_verified",
          )}
        </p>{/if}
    </li>{/each}
</ol>
