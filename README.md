# NostrCoWiki

Requires Node.js 24 or later and npm.

```sh
npm install
npm run dev
```

Open http://localhost:8787. This builds the SvelteKit Web Worker and starts it
alongside the Relay Worker in one Wrangler process. Restart the command after
changing Web code. Both Workers bind to the same Relay-owned SQLite Wiki Durable
Object. No Cloudflare account is required for local development.

For SvelteKit live reload, run `npm run dev:web`. The standalone Relay can be
started with `npm run dev:relay`. Use the combined `npm run dev` command to
verify Worker bindings together.

```sh
npm run build
npm test
```

Application code uses TypeScript with strict checking. `npm test` generates Worker
binding types, checks both applications, builds them, and runs the runtime test.
Use `npm run types` to regenerate the committed `worker-configuration.d.ts` files
after changing Wrangler configuration; do not edit those files manually.
`npm run check` runs type generation and checking without building.

The runtime test checks server-rendered HTML and Web-to-Relay/DO bindings using
local Workers. Its connection probes exist only in the test entry point.

The Durable Object uses Cloudflare's declarative
[class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
with SQLite storage. Combined development uses the official
[multiple-Worker workflow](https://developers.cloudflare.com/workers/local-development/multi-workers/).

The Relay accepts NIP-01 WebSocket connections at `/`. To submit Revisions locally,
set the Wiki signing key in `apps/relay/.dev.vars` (an ignored file):

```text
WIKI_PRIVATE_KEY=<the Wiki's nsec1... private key>
```

Run `npm run dev:relay` and connect to `ws://localhost:8787/`. Backend tests inject
their own test key and require no credentials.

The Web Worker's `WIKI` binding accesses the same object through
`env.WIKI.getByName("wiki")`. Its `getArticle(d)` method returns the latest public
Article event or `null`; `getHistory(d)` returns accepted Commit/Revision pairs in
sequence order. Unpublished articles return `null` or an empty history. These are
Worker RPC methods, not public HTTP endpoints.

Backend integration tests use Wrangler's test harness to exercise WebSockets,
SQLite transactions, search, and Durable Object hibernation and restart.
