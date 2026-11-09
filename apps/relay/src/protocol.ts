import { verifyEvent, type Event } from "nostr-tools/pure";

function normalizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s/gu, "-")
    .replace(/[^\p{L}\p{N}\p{M}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const hexId = /^[0-9a-f]{64}$/;

export interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  [tag: `#${string}`]: string[];
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function signedEvent(value: unknown): Event {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !hexId.test(value.id) ||
    typeof value.pubkey !== "string" ||
    !hexId.test(value.pubkey) ||
    typeof value.sig !== "string" ||
    !/^[0-9a-f]{128}$/.test(value.sig) ||
    !integer(value.created_at) ||
    !integer(value.kind) ||
    value.kind > 65535 ||
    typeof value.content !== "string" ||
    !Array.isArray(value.tags) ||
    !value.tags.every(
      (tag) =>
        Array.isArray(tag) &&
        tag.length > 0 &&
        tag.every((part) => typeof part === "string"),
    )
  )
    throw new Error("invalid: malformed event");
  // Copy only NIP-01 fields; verification caches and extra fields are never trusted.
  const event: Event = {
    id: value.id,
    pubkey: value.pubkey,
    sig: value.sig,
    created_at: value.created_at,
    kind: value.kind,
    content: value.content,
    tags: value.tags,
  };
  if (!verifyEvent(event)) throw new Error("invalid: event ID or signature");
  return event;
}

export function revisionTarget(event: Event, wikiPubkey: string): string {
  if (event.kind !== 2818)
    throw new Error("blocked: only Wiki Revisions may be submitted");
  for (const name of ["a", "e", "title", "summary", "edit_summary"]) {
    const tags = event.tags.filter((tag) => tag[0] === name);
    if (tags.length > 1 || tags.some((tag) => tag.length < 2))
      throw new Error(`invalid: ${name} tag`);
  }
  const address = event.tags.find((tag) => tag[0] === "a")?.[1];
  const prefix = `30818:${wikiPubkey}:`;
  if (!address?.startsWith(prefix))
    throw new Error("invalid: target Wiki address");
  const d = address.slice(prefix.length);
  if (!d || normalizeIdentifier(d) !== d)
    throw new Error("invalid: article identifier");
  const base = event.tags.find((tag) => tag[0] === "e")?.[1];
  if (base !== undefined && !hexId.test(base))
    throw new Error("invalid: base Commit ID");
  return d;
}

export function parseFilter(value: unknown): Filter {
  if (!record(value)) throw new Error("invalid: filter must be an object");
  for (const [key, field] of Object.entries(value)) {
    if (["since", "until", "limit"].includes(key)) {
      if (!integer(field)) throw new Error(`invalid: ${key} filter`);
    } else if (key === "search") {
      if (typeof field !== "string") throw new Error("invalid: search filter");
    } else if (
      ["ids", "authors", "kinds"].includes(key) ||
      /^#[a-zA-Z]$/.test(key)
    ) {
      if (
        !Array.isArray(field) ||
        !field.every((item) =>
          key === "kinds"
            ? integer(item) && item <= 65535
            : typeof item === "string" &&
              (!["ids", "authors", "#e", "#p"].includes(key) ||
                (item.length === 64 && hexId.test(item))),
        )
      )
        throw new Error(`invalid: ${key} filter`);
    } else throw new Error(`unsupported: filter ${key}`);
  }
  return value as Filter;
}

export function searchText(search: string): string {
  // NIP-50 extensions are not part of the initial search interface.
  return search
    .replace(/\S+:\S+/gu, "")
    .trim()
    .toLowerCase();
}

export function searchRank(event: Event, query: string): number {
  if (event.kind !== 30818 || [...query].length < 3) return Infinity;
  const fields = ["d", "title", "summary"].map(
    (name) => event.tags.find((tag) => tag[0] === name)?.[1] ?? "",
  );
  fields.push(event.content);
  return Math.min(
    ...fields.map((field, index) => {
      const text = field.toLowerCase();
      const priority = Math.max(0, index - 1) * 2;
      return text === query
        ? priority
        : text.includes(query)
          ? priority + 1
          : Infinity;
    }),
  );
}

export function matches(event: Event, filter: Filter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since)
    return false;
  if (filter.until !== undefined && event.created_at > filter.until)
    return false;
  for (const [key, values] of Object.entries(filter)) {
    if (
      key.startsWith("#") &&
      !event.tags.some(
        (tag) =>
          tag[0] === key.slice(1) && (values as string[]).includes(tag[1]),
      )
    )
      return false;
  }
  return (
    filter.search === undefined ||
    Number.isFinite(searchRank(event, searchText(filter.search)))
  );
}

export function newestFirst(a: Event, b: Event): number {
  return b.created_at - a.created_at || a.id.localeCompare(b.id);
}

export function bytes(hex: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16));
}
