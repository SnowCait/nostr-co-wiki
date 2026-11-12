<script lang="ts">
  import { get, type NoticeKey } from "#lib/i18n.ts";
  const i18n = get();
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import { waitNostr } from "nip07-awaiter";
  import { getToken } from "nostr-tools/nip98";
  import type { Event } from "nostr-tools/pure";
  import { title } from "#lib/article.ts";
  let signingAvailable = $state(false);
  let articles = $state<{ d: string; published: boolean; article: Event }[]>(
    [],
  );
  let selected = $state<Event | null>(null);
  let busy = $state(false);
  let notice = $state<NoticeKey | "">("");
  onMount(() => {
    const controller = new AbortController();
    waitNostr(0, { signal: controller.signal })
      .then((nostr) => {
        if (!controller.signal.aborted && nostr) {
          signingAvailable = true;
        }
      })
      .catch(() => {});
    return () => controller.abort();
  });
  async function request<T>(d?: string, published?: boolean) {
    const signer = window.nostr;
    if (!signer) {
      throw new Error("common.a_nip_07_signing_extension_is_required");
    }
    const url = new URL("/api/admin/articles", window.location.origin);
    if (d !== undefined) {
      url.searchParams.set("d", d);
    }
    const method = published === undefined ? "GET" : "PUT";
    const payload = published === undefined ? undefined : { published };
    const authorization = await getToken(
      url.href,
      method,
      (event) => signer.signEvent(event),
      true,
      payload,
    ).catch(() => {
      throw new Error("common.administrator_signing_failed");
    });
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    }).catch(() => {
      throw new Error("common.the_administration_request_failed");
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "common.administrator_authentication_failed_or_access_was_denied"
          : "common.the_administration_request_failed",
      );
    }
    return response.json() as Promise<T>;
  }
  async function load() {
    busy = true;
    notice = "";
    selected = null;
    try {
      articles = await request<typeof articles>();
    } catch (error) {
      articles = [];
      notice =
        error instanceof Error
          ? (error.message as NoticeKey)
          : "common.unable_to_load_articles";
    } finally {
      busy = false;
    }
  }
  async function change(d: string, published: boolean) {
    busy = true;
    notice = "";
    try {
      await request(d, published);
      articles = await request<typeof articles>();
      selected = null;
      notice = published
        ? "common.article_republished"
        : "common.article_unpublished";
    } catch (error) {
      notice =
        error instanceof Error
          ? (error.message as NoticeKey)
          : "common.unable_to_change_publication_state";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>{i18n.t("common.manage_articles")} — NostrCoWiki</title></svelte:head
>
<h1>{i18n.t("common.manage_articles")}</h1>
<a href={resolve("/admin")}>{i18n.t("common.administration_dashboard")}</a>
{#if !signingAvailable}<p role="status">
    {i18n.t(
      "common.waiting_for_a_nip_07_signing_extension_administrator_requests_require_a_signature",
    )}
  </p>{/if}
<button disabled={!signingAvailable || busy} onclick={load}
  >{i18n.t("common.load_articles")}</button
>
{#if notice}<p role="status">{i18n.t(notice)}</p>{/if}
{#if articles.length}<ul>
    {#each articles as item (item.d)}<li>
        <h2>{title(item.article)}</h2>
        <p>
          {item.published
            ? i18n.t("common.published")
            : i18n.t("common.unpublished")}
        </p>
        <button disabled={busy} onclick={() => change(item.d, !item.published)}
          >{item.published
            ? i18n.t("common.unpublish")
            : i18n.t("common.republish")}</button
        ><button disabled={busy} onclick={() => (selected = item.article)}
          >{i18n.t("common.view_content")}</button
        >
      </li>{/each}
  </ul>{:else}<p>{i18n.t("common.no_articles_loaded")}</p>{/if}
{#if selected}<section>
    <h2>{title(selected)}</h2>
    <pre>{selected.content}</pre>
  </section>{/if}
