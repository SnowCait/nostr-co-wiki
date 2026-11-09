import { DurableObject } from "cloudflare:workers";
import { decode } from "nostr-tools/nip19";
import { finalizeEvent, getPublicKey, type Event } from "nostr-tools/pure";
import { schema } from "./schema";
import {
  bytes,
  matches,
  newestFirst,
  parseFilter,
  record,
  revisionTarget,
  searchRank,
  searchText,
  signedEvent,
  type Filter,
} from "./protocol";

interface Connection {
  ip: string;
  subscriptions: { id: string; filters: Filter[] }[];
}

type ArticleState = {
  id: number;
  head_commit_id: ArrayBuffer;
  published_event_id: ArrayBuffer | null;
  is_published: number;
};

interface WikiEnvironment {
  WIKI_PRIVATE_KEY: string;
}

export class Wiki extends DurableObject<WikiEnvironment> {
  constructor(ctx: DurableObjectState, env: WikiEnvironment) {
    super(ctx, env);
    ctx.storage.transactionSync(() => ctx.storage.sql.exec(schema));
  }

  fetch(request: Request): Response {
    if (
      new URL(request.url).pathname !== "/" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const ip = request.headers.get("X-Wiki-IP");
    if (!ip) return new Response("Missing connection address", { status: 400 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ ip, subscriptions: [] } satisfies Connection);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    socket: WebSocket,
    data: string | ArrayBuffer,
  ): Promise<void> {
    let message: unknown;
    try {
      if (typeof data !== "string") throw new Error();
      message = JSON.parse(data);
    } catch {
      this.#send(socket, ["NOTICE", "invalid: expected a JSON message"]);
      return;
    }
    if (!Array.isArray(message)) {
      this.#send(socket, ["NOTICE", "invalid: expected a message array"]);
      return;
    }
    if (message[0] === "EVENT") {
      const id =
        record(message[1]) && typeof message[1].id === "string"
          ? message[1].id
          : "";
      let event: Event;
      let accepted: Event[];
      try {
        if (message.length !== 2) throw new Error("invalid: EVENT message");
        event = signedEvent(message[1]);
        const connection: Connection = socket.deserializeAttachment();
        accepted = await this.#acceptRevision(event, connection.ip);
      } catch (error) {
        const reason =
          error instanceof Error &&
          /^(invalid|unsupported|conflict|blocked):/.test(error.message)
            ? error.message
            : "error: unable to accept Revision";
        this.#send(socket, ["OK", id, false, reason]);
        return;
      }
      this.#send(socket, [
        "OK",
        event.id,
        true,
        accepted.length ? "" : "duplicate: already accepted",
      ]);
      for (const published of accepted) this.#broadcast(published);
      return;
    }
    if (message[0] === "REQ" || message[0] === "CLOSE") {
      const id = message[1];
      if (typeof id !== "string" || !id || [...id].length > 64) {
        this.#send(socket, ["NOTICE", "invalid: subscription ID"]);
        return;
      }
      const connection: Connection = socket.deserializeAttachment();
      connection.subscriptions = connection.subscriptions.filter(
        (sub) => sub.id !== id,
      );
      socket.serializeAttachment(connection);
      if (message[0] === "CLOSE") return;
      try {
        if (message.length < 3) throw new Error("invalid: REQ needs filters");
        const filters = message.slice(2).map(parseFilter);
        const events = this.#query(filters);
        connection.subscriptions.push({ id, filters });
        try {
          socket.serializeAttachment(connection);
        } catch {
          throw new Error(
            "error: subscription state exceeds connection capacity",
          );
        }
        for (const event of events) this.#send(socket, ["EVENT", id, event]);
        this.#send(socket, ["EOSE", id]);
      } catch (error) {
        this.#send(socket, [
          "CLOSED",
          id,
          error instanceof Error &&
          /^(invalid|unsupported|error):/.test(error.message)
            ? error.message
            : "error: unable to retrieve events",
        ]);
      }
      return;
    }
    this.#send(socket, ["NOTICE", "unsupported: message type"]);
  }

  webSocketClose(socket: WebSocket, code: number): void {
    socket.close(code);
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "Connection error");
  }

  getArticle(d: string): Event | null {
    return (
      this.ctx.storage.sql
        .exec<{ data: string }>(
          `SELECT e.data FROM articles a JOIN events e ON e.id = a.published_event_id
       WHERE a.d = ? AND a.is_published = 1`,
          d,
        )
        .toArray()
        .map((row) => JSON.parse(row.data) as Event)[0] ?? null
    );
  }

  getHistory(d: string): { commit: Event; revision: Event | null }[] {
    return this.ctx.storage.sql
      .exec<{ commit_data: string; revision_data: string | null }>(
        `SELECT c.data AS commit_data, r.data AS revision_data
       FROM articles a JOIN events c ON c.article_d = a.d AND c.kind = 3818
       LEFT JOIN events r ON r.id = c.ref_event_id
       WHERE a.d = ? AND a.is_published = 1 ORDER BY c.seq`,
        d,
      )
      .toArray()
      .map((row) => ({
        commit: JSON.parse(row.commit_data) as Event,
        revision:
          row.revision_data === null
            ? null
            : (JSON.parse(row.revision_data) as Event),
      }));
  }

  #query(filters: Filter[]): Event[] {
    const results = new Map<string, Event>();
    for (const filter of filters) {
      if (filter.limit === 0) continue;
      const query =
        filter.search === undefined ? undefined : searchText(filter.search);
      if (query !== undefined && [...query].length < 3) continue;
      let statement =
        query === undefined
          ? `SELECT e.data FROM events e JOIN articles a ON a.d = e.article_d WHERE a.is_published = 1`
          : `SELECT e.data FROM article_fts f JOIN articles a ON a.id = f.rowid
           JOIN events e ON e.id = a.published_event_id WHERE a.is_published = 1 AND article_fts MATCH ?`;
      const bindings: SqlStorageValue[] =
        query === undefined ? [] : [`"${query.replaceAll('"', '""')}"`];
      const constrain = (column: string, values: SqlStorageValue[]) => {
        statement += ` AND ${column} IN (${values.map(() => "?").join(",")})`;
        bindings.push(...values);
      };
      if (filter.kinds) constrain("e.kind", filter.kinds);
      if (filter.ids)
        constrain(
          "e.id",
          filter.ids.map((id) => bytes(id).buffer),
        );
      if (filter.authors)
        constrain(
          "e.pubkey",
          filter.authors.map((author) => bytes(author).buffer),
        );
      if (filter.since !== undefined) {
        statement += " AND e.created_at >= ?";
        bindings.push(filter.since);
      }
      if (filter.until !== undefined) {
        statement += " AND e.created_at <= ?";
        bindings.push(filter.until);
      }
      const rows = this.ctx.storage.sql.exec<{ data: string }>(
        statement,
        ...bindings,
      );
      const events = rows
        .toArray()
        .map((row) => JSON.parse(row.data) as Event)
        .filter((event) => matches(event, filter));
      events.sort(
        query === undefined
          ? newestFirst
          : (a, b) =>
              searchRank(a, query) - searchRank(b, query) || newestFirst(a, b),
      );
      for (const event of events.slice(0, filter.limit))
        results.set(event.id, event);
    }
    const events = [...results.values()];
    return filters.every((filter) => filter.search === undefined)
      ? events.sort(newestFirst)
      : events;
  }

  async #acceptRevision(revision: Event, ip: string): Promise<Event[]> {
    const key = decode(this.env.WIKI_PRIVATE_KEY);
    if (key.type !== "nsec") throw new Error("Wiki signing key must be nsec");
    const pubkey = getPublicKey(key.data);
    const d = revisionTarget(revision, pubkey);
    const base = revision.tags.find((tag) => tag[0] === "e")?.[1];
    for (;;) {
      const article = this.ctx.storage.sql
        .exec<ArticleState>("SELECT * FROM articles WHERE d = ?", d)
        .toArray()[0];
      if (article && article.is_published !== 1)
        throw new Error("blocked: article is unpublished");
      if (
        this.ctx.storage.sql
          .exec(
            "SELECT id FROM events WHERE kind = 3818 AND ref_event_id = ?",
            bytes(revision.id),
          )
          .toArray().length
      )
        return [];
      const previous = article ? this.#event(article.head_commit_id) : null;
      if (previous?.id !== base)
        throw new Error("conflict: base Commit does not match current article");
      const published = article?.published_event_id
        ? this.#event(article.published_event_id)
        : null;
      const now = Math.floor(Date.now() / 1000);
      if (published && published.created_at >= now) {
        // Other events may run while waiting. Re-read the article and base afterward.
        await new Promise((resolve) =>
          setTimeout(resolve, (published.created_at + 1) * 1000 - Date.now()),
        );
        continue;
      }
      const seq = previous
        ? Number(previous.tags.find((tag) => tag[0] === "seq")![1]) + 1
        : 1;
      const commit = finalizeEvent(
        {
          kind: 3818,
          created_at: now,
          content: "",
          tags: [
            ["a", `30818:${pubkey}:${d}`],
            ["e", revision.id],
            ...(previous ? [["prev", previous.id]] : []),
            ["seq", String(seq)],
          ],
        },
        key.data,
      );
      const articleEvent = finalizeEvent(
        {
          kind: 30818,
          created_at: now,
          content: revision.content,
          tags: [
            ["d", d],
            ...revision.tags.filter(
              (tag) => tag[0] === "title" || tag[0] === "summary",
            ),
            ["head", commit.id],
          ],
        },
        key.data,
      );
      this.ctx.storage.transactionSync(() => {
        this.#insertEvent(revision, d);
        this.ctx.storage.sql.exec(
          "INSERT INTO event_receipts (revision_id, ip_address, received_at) VALUES (?, ?, ?)",
          bytes(revision.id),
          ip,
          now,
        );
        this.#insertEvent(commit, d, bytes(revision.id), seq);
        if (article?.published_event_id)
          this.ctx.storage.sql.exec(
            "DELETE FROM events WHERE id = ?",
            article.published_event_id,
          );
        this.#insertEvent(articleEvent, d);
        this.ctx.storage.sql.exec(
          `INSERT INTO articles (d, head_commit_id, published_event_id, is_published) VALUES (?, ?, ?, 1)
           ON CONFLICT(d) DO UPDATE SET head_commit_id = excluded.head_commit_id, published_event_id = excluded.published_event_id`,
          d,
          bytes(commit.id),
          bytes(articleEvent.id),
        );
        const id = this.ctx.storage.sql
          .exec<{ id: number }>("SELECT id FROM articles WHERE d = ?", d)
          .one().id;
        this.ctx.storage.sql.exec(
          "DELETE FROM article_fts WHERE rowid = ?",
          id,
        );
        this.ctx.storage.sql.exec(
          "INSERT INTO article_fts (rowid, d, title, summary, content) VALUES (?, ?, ?, ?, ?)",
          id,
          d,
          revision.tags.find((tag) => tag[0] === "title")?.[1] ?? d,
          revision.tags.find((tag) => tag[0] === "summary")?.[1] ?? "",
          revision.content,
        );
      });
      return [revision, commit, articleEvent];
    }
  }

  #event(id: ArrayBuffer): Event {
    const row = this.ctx.storage.sql
      .exec<{ data: string }>("SELECT data FROM events WHERE id = ?", id)
      .one();
    return JSON.parse(row.data) as Event;
  }

  #insertEvent(
    event: Event,
    d: string,
    ref: Uint8Array | null = null,
    seq: number | null = null,
  ): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO events (id, kind, pubkey, created_at, article_d, ref_event_id, seq, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      bytes(event.id),
      event.kind,
      bytes(event.pubkey),
      event.created_at,
      d,
      ref,
      seq,
      JSON.stringify(event),
    );
  }

  #send(socket: WebSocket, message: unknown[]): void {
    // A disconnected peer must not turn an already committed edit into a rejection.
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  }

  #broadcast(event: Event): void {
    for (const socket of this.ctx.getWebSockets()) {
      const connection: Connection = socket.deserializeAttachment();
      for (const sub of connection.subscriptions) {
        if (sub.filters.some((filter) => matches(event, filter)))
          this.#send(socket, ["EVENT", sub.id, event]);
      }
    }
  }
}
