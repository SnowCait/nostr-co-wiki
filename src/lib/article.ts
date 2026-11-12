import type { Event } from "nostr-tools/pure";
export function tag(event: Event, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}
export function articlePath(d: string): `/wiki/${string}` {
  return `/wiki/${encodeURIComponent(d)}`;
}
export function title(event: Event): string {
  return tag(event, "title") ?? tag(event, "d") ?? "Untitled";
}
export function date(timestamp: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(timestamp * 1000));
}

export interface ArticleResponse {
  status: "available" | "published" | "unpublished";
  article: Event | null;
  reflectsRevision: boolean;
}
