<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
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
  let notice = $state("");
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
      throw new Error(m.a_nip_07_signing_extension_is_required());
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
      throw new Error(m.administrator_signing_failed());
    });
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    }).catch(() => {
      throw new Error(m.the_administration_request_failed());
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? m.administrator_authentication_failed_or_access_was_denied()
          : m.the_administration_request_failed(),
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
        error instanceof Error ? error.message : m.unable_to_load_articles();
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
      notice = published ? m.article_republished() : m.article_unpublished();
    } catch (error) {
      notice =
        error instanceof Error
          ? error.message
          : m.unable_to_change_publication_state();
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{m.manage_articles()} — NostrCoWiki</title></svelte:head>
<h1>{m.manage_articles()}</h1>
<a href={resolve("/admin")}>{m.administration_dashboard()}</a>
{#if !signingAvailable}<p role="status">
    {m.waiting_for_a_nip_07_signing_extension_administrator_requests_require_a_signature()}
  </p>{/if}
<button disabled={!signingAvailable || busy} onclick={load}
  >{m.load_articles()}</button
>
<p role="status">{notice}</p>
{#if articles.length}<ul>
    {#each articles as item (item.d)}<li>
        <h2>{title(item.article)}</h2>
        <p>{item.published ? m.published() : m.unpublished()}</p>
        <button disabled={busy} onclick={() => change(item.d, !item.published)}
          >{item.published ? m.unpublish() : m.republish()}</button
        ><button disabled={busy} onclick={() => (selected = item.article)}
          >{m.view_content()}</button
        >
      </li>{/each}
  </ul>{:else}<p>{m.no_articles_loaded()}</p>{/if}
{#if selected}<section>
    <h2>{title(selected)}</h2>
    <pre>{selected.content}</pre>
  </section>{/if}
