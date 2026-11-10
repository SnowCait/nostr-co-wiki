# NostrCoWiki Architecture

## Scope

NostrCoWiki is a collaboratively edited Wiki built on Nostr. Each deployment hosts one Wiki and runs exclusively on Cloudflare.

This document describes system components, their responsibilities, and the flow between them. The following documents have separate responsibilities:

- [Protocol specification](protocol.md): event formats, acceptance rules, and externally observable relay behavior. It is the authoritative source for protocol behavior.
- [Database design](database.md): the SQLite schema, indexes, and persistence rules.

## Components

| Component | Responsibility |
| --- | --- |
| Web (`apps/web/`) | A single SvelteKit application on one Cloudflare Worker; renders public article pages with SSR, provides the editing UI, and serves the administrator dashboard. |
| Relay (`apps/relay/`) | Independent Cloudflare Worker; accepts Nostr WebSocket connections and exposes administrative HTTP operations. |
| Wiki Durable Object | One SQLite-backed Durable Object per Wiki; handles subscriptions and Wiki-specific event processing, and owns persistent state. |
| Protocol package (`packages/protocol/`) | Shared code required by both the Web and Relay applications. Application-specific code remains in its application. |

Nostr relay handling and Wiki-specific event processing are separate responsibilities inside the same Durable Object. The design does not introduce D1, external PostgreSQL, or external Pub/Sub.

## Communication

- **Reading:** The Web Worker fetches published Article data through a Durable Object binding and renders the page on the server.
- **Editing:** The browser signs Revisions through NIP-07 and sends them to the Relay over NIP-01 WebSocket. NIP-46 is a possible future option, not an initial dependency.
- **Subscriptions:** The Relay serves NIP-01 event subscriptions through the Wiki Durable Object.
- **Administration:** The dashboard uses the existing Relay Worker HTTP API. Administrative operations and HTTP requests for unpublished article information require NIP-98 authentication and administrator authorization. Detailed routes and payloads are implementation concerns.

## Host-Based Routing

The optional Web Worker environment variable `ADMIN_HOSTNAME` selects how the public site and administrator dashboard are routed. It contains a hostname without a scheme or path; no specific domain is hardcoded.

When `ADMIN_HOSTNAME` is unset, the dashboard is available on the public site's host at `/admin`, and the article management list is at `/admin/articles`. This also works on a `workers.dev` hostname and does not require a custom domain.

When `ADMIN_HOSTNAME` is set, the dashboard is available at `/` on that hostname, and the article management list is at `/articles`. Requests to the administrator hostname are internally routed to the SvelteKit `/admin` routes while the browser URL remains unchanged. On every other hostname, including `workers.dev`, `/admin` and `/admin/*` return 404 Not Found, even for administrators.

In both configurations, the public site has no administration controls or links to the dashboard.

SvelteKit `reroute` and `handle` are candidates for implementing this routing. This document does not prescribe implementation code. The dashboard shares the existing Web Worker, Relay Worker, and Wiki Durable Object; no dedicated dashboard Worker or SvelteKit application is introduced.

## Revision Processing

The Wiki Durable Object performs Revision acceptance and publication according to [protocol.md](protocol.md).

1. Validate the editor-signed Revision and check its base Commit against the current article state.
2. For an already accepted Revision, return the appropriate acceptance result without creating another Commit or receipt.
3. If the new Article would have the same `created_at` second as the previously published Article, wait for the next second instead of using a future timestamp.
4. Commit the accepted Revision, its receipt, the Wiki-signed Commit, the Wiki-signed Article, the article state, and the full-text index update in **one SQLite transaction**.
5. Return the NIP-01 acceptance result after the transaction commits.

No publication queue, Durable Objects Alarm, timer-based publication workflow, or separate recovery mechanism is introduced.

## Storage and Queries

The Wiki Durable Object uses its built-in SQLite database. The initial model has four tables:

| Table | Responsibility |
| --- | --- |
| `events` | Stores accepted Revisions and Commits, and the latest published Article event per article. |
| `articles` | Stores each article's current Commit, published Article reference, and publication state. |
| `article_fts` | Indexes published articles for NIP-50 search. |
| `event_receipts` | Records the originating IP address and receipt time for the initial acceptance of a Revision. |

The complete schema and index definitions are in [database.md](database.md).

The Durable Object evaluates supported NIP-01 filters correctly, including filters without a dedicated index. Search returns only published Articles; its externally observable ranking rules belong to [protocol.md](protocol.md), while specific ranking SQL is left to implementation.

Unpublished articles are excluded from public rendering, search results, and relay subscription delivery. Their stored history is retained, and new Revisions for them are rejected, as specified in the protocol.

## WebSocket Connections

The Durable Object uses the WebSocket Hibernation API. Per-connection subscription state is held in WebSocket attachments and restored after hibernation.

The Relay Worker obtains the client's IP address when establishing a WebSocket connection and passes it to the Durable Object, which uses it for Revision acceptance receipts.

## Keys and Administration

- `WIKI_PRIVATE_KEY`: Relay Worker Secret containing the Wiki private key in `nsec1...` format, used for signing Commits and Articles.
- `ADMIN_PUBLIC_KEY`: environment variable containing the administrator's public key in `npub1...` format.
- `ADMIN_HOSTNAME`: optional Web Worker environment variable selecting the administrator hostname, without a scheme or path, as described in [Host-Based Routing](#host-based-routing).
- The administrator's private key is not stored by the Relay. No custom login session or private-key storage mechanism is introduced.
- Administrator privileges apply to the whole Wiki, not individual articles.
- Administrators can unpublish and republish articles through the NIP-98-authenticated HTTP API without generating Revisions or Commits. Requests for unpublished article information and administrative operations require both authentication and administrator authorization based on `ADMIN_PUBLIC_KEY`; hostname-based routing is not a substitute for either.

## Article Rendering

Article content is Djot. The Web Worker converts it to HTML and sanitizes the output before rendering. Article links follow NIP-54. The Djot library has not yet been selected.

## Repository Structure

```text
apps/
  web/
  relay/
packages/
  protocol/
docs/
  protocol.md
  architecture.md
  database.md
```

npm workspaces is the preferred workspace arrangement. The Deploy to Cloudflare button remains undecided.

## Initial Protocol Scope

The initial implementation supports NIP-01, NIP-50 Article search, and NIP-54 Articles. NIP-09 and NIP-62 are not implemented initially; their behavior remains specified in [protocol.md](protocol.md) for a future implementation.

## References

- [NostrCoWiki Protocol Specification](protocol.md)
- [NostrCoWiki Database Design](database.md)
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md)
- [NIP-54](https://github.com/nostr-protocol/nips/blob/master/54.md)
- [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md)
- [Cloudflare: SvelteKit](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)
- [Cloudflare: SQLite-backed Durable Object Storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Cloudflare: WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
