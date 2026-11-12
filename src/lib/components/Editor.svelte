<script lang="ts">
  import { get, type NoticeKey } from "#lib/i18n.ts";
  const i18n = get();
  import { subscribeArticle } from "#lib/article-updates.ts";
  import RenderedArticle from "#lib/components/RenderedArticle.svelte";
  import { resolve } from "$app/paths";
  import { onMount, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { waitNostr } from "nip07-awaiter";
  import { normalizeIdentifier } from "#lib/identifier.ts";
  import { articlePath, tag, type ArticleResponse } from "#lib/article.ts";
  import { createRevision, submitRevision } from "#lib/submission.ts";
  import type { Event } from "nostr-tools/pure";
  let {
    data,
  }: {
    data: {
      d: string;
      title: string;
      content: string;
      summary: string;
      base?: string;
      baseContent?: string;
      restored?: string;
      wikiPubkey: string;
      relayUrl: string;
    };
  } = $props();
  const initial = untrack(() => data);
  let articleTitle = $state(initial.title);
  let content = $state(initial.content);
  let summary = $state(initial.summary);
  let editSummary = $state(
    initial.restored
      ? untrack(() =>
          i18n.t("common.restore_edit_summary", {
            revision: initial.restored!,
          }),
        )
      : "",
  );
  let base = $state(initial.base);
  let baseContent = $state(initial.baseContent ?? initial.content);
  let baseSummary = $state(initial.summary);
  const d = $derived(data.base ? data.d : normalizeIdentifier(articleTitle));
  let editorView = $state<"edit" | "preview">("edit");
  let origin = $state("");
  let signingAvailable = $state(false);
  let availability = $state("checking");
  let preview = $state("");
  let previewError = $state<NoticeKey | "">("");
  let busy = $state(false);
  let notice = $state<NoticeKey | "">("");
  let submission = $state<import("#lib/submission.ts").SubmissionResult | null>(
    null,
  );
  let outcome = $state("");
  let acceptedId = $state("");
  let updated = $state(false);
  let latest = $state<Event | null>(null);
  onMount(() => {
    origin = window.location.origin;
    const controller = new AbortController();
    waitNostr(0, { signal: controller.signal })
      .then((nostr) => {
        if (!controller.signal.aborted && nostr) {
          signingAvailable = true;
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Unable to detect the signing extension", error);
        }
      });
    return () => controller.abort();
  });
  $effect(() => {
    const identifier = d;
    if (data.base) {
      availability = "published";
      return;
    }
    availability = identifier ? "checking" : "invalid";
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!identifier) {
        return;
      }
      try {
        const response = await fetch(
          `/api/article?d=${encodeURIComponent(identifier)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error();
        }
        const result = (await response.json()) as ArticleResponse;
        if (!controller.signal.aborted) {
          availability = result.status;
        }
      } catch {
        if (!controller.signal.aborted) {
          availability = "error";
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
  $effect(() => {
    const source = content;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: source }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error();
        }
        const result = (await response.json()) as { html: string };
        if (!controller.signal.aborted) {
          preview = result.html;
          previewError = "";
        }
      } catch {
        if (!controller.signal.aborted) {
          previewError =
            "common.preview_is_unavailable_your_source_is_preserved";
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
  $effect(() => {
    const commit = base;
    updated = false;
    if (!commit) {
      return;
    }
    return subscribeArticle(
      data.relayUrl,
      data.wikiPubkey,
      data.d,
      (article) => {
        if (tag(article, "head") !== commit) {
          updated = true;
        }
      },
    );
  });
  async function checkPublication() {
    busy = true;
    try {
      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await fetch(
          `/api/article?d=${encodeURIComponent(d)}&revision=${acceptedId}`,
        );
        if (!response.ok) {
          throw new Error();
        }
        const result = (await response.json()) as ArticleResponse;
        if (result.article && result.reflectsRevision) {
          await goto(resolve("/wiki/[d]", { d }), { refreshAll: true });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      notice =
        "common.your_revision_was_accepted_but_publication_is_not_yet_confirmed_you_can_check_again";
    } catch {
      notice =
        "common.your_revision_was_accepted_unable_to_check_publication_right_now_check_again_before_resubmitting";
    } finally {
      busy = false;
    }
  }
  async function loadLatest() {
    try {
      const response = await fetch(`/api/article?d=${encodeURIComponent(d)}`);
      if (!response.ok) {
        throw new Error();
      }
      latest = ((await response.json()) as { article: Event | null }).article;
      if (!latest) {
        notice =
          "common.this_article_is_no_longer_publicly_available_your_draft_is_preserved";
      }
    } catch {
      notice =
        "common.unable_to_load_the_latest_article_your_draft_is_preserved";
    }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    notice = "common.waiting_for_your_signing_extension_and_relay_response";
    outcome = "";
    busy = true;
    latest = null;
    const result = await submitRevision(
      window.nostr,
      data.relayUrl,
      createRevision({
        wikiPubkey: data.wikiPubkey,
        d,
        title: articleTitle,
        summary,
        editSummary,
        content,
        base,
      }),
    );
    outcome = result.type;
    notice = "";
    submission = result;
    busy = false;
    if (result.type === "accepted" && result.id) {
      acceptedId = result.id;
      await checkPublication();
    } else if (result.type === "conflict") {
      await loadLatest();
    }
  }
</script>

{#if data.restored}<p class="notice">
    {i18n.t("common.restoration_notice", { revision: data.restored })}
  </p>{/if}
{#if !signingAvailable}<p class="notice" role="status">
    {i18n.t(
      "common.waiting_for_a_nip_07_compatible_signing_extension_one_is_required_to_create_or_edit_articles_reading_remains_available",
    )}
  </p>{/if}
{#if updated}<p class="notice" role="status">
    {i18n.t(
      "common.this_article_has_been_updated_your_draft_and_base_commit_are_unchanged",
    )}
    <a href={resolve("/wiki/[d]", { d })} target="_blank" rel="noopener"
      >{i18n.t("common.view_latest_article_in_a_new_tab")}</a
    >
  </p>{/if}
<form class="editor-form" onsubmit={submit} aria-busy={busy}>
  <fieldset disabled={busy || !!acceptedId}>
    <label for="title">{i18n.t("common.title_required")}</label><input
      id="title"
      bind:value={articleTitle}
      readonly={!!data.base}
      required
    />
    <div class="article-address">
      <p class="metadata">
        {i18n.t("common.article_identifier")}
        <code>{d || i18n.t("common.enter_a_title")}</code>
      </p>
      <p class="metadata">
        {i18n.t("common.article_url")} <output>{origin}{articlePath(d)}</output>
      </p>
      {#if !data.base}<p class="availability" aria-live="polite">
          {#if availability === "published"}{i18n.t(
              "common.this_article_already_exists",
            )}
            <a href={resolve("/wiki/[d]", { d })}
              >{i18n.t("common.read_the_existing_article")}</a
            >
            {i18n.t("common.submission_is_unavailable")}
          {:else if availability === "unpublished"}{i18n.t(
              "common.this_url_is_unavailable",
            )}
          {:else if availability === "available"}{i18n.t(
              "common.this_identifier_is_available_it_is_not_reserved",
            )}
          {:else if availability === "checking"}{i18n.t(
              "common.checking_the_identifier",
            )}
          {:else if availability === "error"}{i18n.t(
              "common.unable_to_check_this_identifier_please_try_changing_the_title_again",
            )}
          {:else}{i18n.t(
              "common.enter_a_title_that_produces_a_valid_identifier",
            )}{/if}
        </p>{/if}
    </div>
    <div
      class="editor-switch"
      role="group"
      aria-label={i18n.t("common.editor_view")}
    >
      <button
        type="button"
        aria-controls="editor-source"
        aria-pressed={editorView === "edit"}
        onclick={() => (editorView = "edit")}>{i18n.t("common.edit")}</button
      >
      <button
        type="button"
        aria-controls="editor-preview"
        aria-pressed={editorView === "preview"}
        onclick={() => (editorView = "preview")}
        >{i18n.t("common.preview")}</button
      >
    </div>
    <div class="editor-grid">
      <section
        id="editor-source"
        class="source-pane"
        class:mobile-hidden={editorView !== "edit"}
      >
        <h2><label for="content">{i18n.t("common.djot_source")}</label></h2>
        <textarea id="content" bind:value={content} rows="18"></textarea>
      </section>
      <section
        id="editor-preview"
        class="preview-pane"
        class:mobile-hidden={editorView !== "preview"}
        aria-label={i18n.t("common.article_preview")}
      >
        <h2>{i18n.t("common.html_preview")}</h2>
        {#if previewError}<p role="alert">{i18n.t(previewError)}</p>{/if}
        <div class="prose"><RenderedArticle html={preview} /></div>
      </section>
    </div>
    <div class="editor-details">
      <label for="summary">{i18n.t("common.summary_optional")}</label><textarea
        id="summary"
        bind:value={summary}
        rows="2"></textarea>
      <label for="edit-summary">{i18n.t("common.edit_summary_optional")}</label
      ><input id="edit-summary" bind:value={editSummary} />
      <button
        type="submit"
        class="primary"
        disabled={!signingAvailable ||
          !articleTitle.trim() ||
          (!!base && content === baseContent && summary === baseSummary) ||
          !d ||
          (!data.base && availability !== "available")}
        >{i18n.t("common.sign_and_submit_revision")}</button
      >
    </div>
  </fieldset>
</form>
{#if notice}<p
    class="notice"
    class:error={["conflict", "rejected", "signing", "connection"].includes(
      outcome,
    )}
    role="status"
    aria-live="polite"
  >
    {i18n.t(notice)}
  </p>{/if}
{#if submission && !notice}<p class="notice" role="status">
    {#if submission.type === "accepted"}{i18n.t(
        "common.revision_accepted_checking_publication",
      )}
    {:else if submission.type === "connection"}{i18n.t(
        "common.no_acceptance_confirmation_was_received_your_draft_is_preserved_check_the_article_before_resubmitting",
      )}
    {:else if submission.type === "signing"}{i18n.t(
        "common.signing_was_declined_or_the_signer_returned_an_invalid_revision_your_draft_is_preserved",
      )}
    {:else}{i18n.t("common.relay_rejection", {
        reason: submission.message,
      })}{/if}
  </p>{/if}
{#if acceptedId}<button onclick={checkPublication} disabled={busy}
    >{i18n.t("common.check_publication")}</button
  >{/if}
{#if outcome === "conflict"}<section class="conflict-section">
    <h2>{i18n.t("common.resolve_the_edit_conflict")}</h2>
    <p>
      {i18n.t(
        "common.your_draft_has_been_preserved_review_the_latest_article_manually_adjust_your_changes_then_choose_its_commit_as_your_new_base",
      )}
    </p>
    <a href={resolve("/wiki/[d]", { d })} target="_blank" rel="noopener"
      >{i18n.t("common.open_latest_article")}</a
    >
    <button onclick={loadLatest}
      >{i18n.t("common.refresh_latest_article")}</button
    >
    {#if latest}<h3>{tag(latest, "title") ?? d}</h3>
      <pre>{latest.content}</pre>
      <button
        onclick={() => {
          base = tag(latest!, "head");
          baseContent = latest!.content;
          baseSummary = tag(latest!, "summary") ?? "";
          notice =
            "common.using_the_displayed_commit_as_base_your_draft_is_unchanged_review_it_before_resubmitting";
        }}>{i18n.t("common.use_this_commit_as_base")}</button
      >{/if}
  </section>{/if}
