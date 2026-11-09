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

The runtime test checks server-rendered HTML and Web-to-Relay/DO bindings using
local Workers. Its connection probes exist only in the test entry point.

The Durable Object uses Cloudflare's declarative
[class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
with SQLite storage. Combined development uses the official
[multiple-Worker workflow](https://developers.cloudflare.com/workers/local-development/multi-workers/).
