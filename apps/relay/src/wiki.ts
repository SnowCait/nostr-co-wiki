import { DurableObject } from "cloudflare:workers";
import type { Event } from "nostr-tools/pure";
import { acceptRevision } from "./revision";
import { getArticle, getHistory, queryEvents } from "./query";
import { schema } from "./schema";
import {
  matches,
  parseFilter,
  record,
  signedEvent,
  type Filter,
} from "./protocol";

interface Connection {
  ip: string;
  subscriptions: { id: string; filters: Filter[] }[];
}

interface WikiEnvironment {
  WIKI_PRIVATE_KEY: string;
}

export class Wiki extends DurableObject<WikiEnvironment> {
  constructor(ctx: DurableObjectState, env: WikiEnvironment) {
    super(ctx, env);
    ctx.storage.sql.exec(schema);
  }

  fetch(request: Request): Response {
    if (
      new URL(request.url).pathname !== "/" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const ip = request.headers.get("CF-Connecting-IP");
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
        accepted = await acceptRevision(
          this.ctx.storage,
          this.env.WIKI_PRIVATE_KEY,
          event,
          connection.ip,
        );
      } catch (error) {
        const reason =
          error instanceof Error && /^(invalid|blocked):/.test(error.message)
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
        const events = queryEvents(this.ctx.storage.sql, filters);
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
    return getArticle(this.ctx.storage.sql, d);
  }

  getHistory(d: string): { commit: Event; revision: Event | null }[] {
    return getHistory(this.ctx.storage.sql, d);
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
