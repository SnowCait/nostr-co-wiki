# NostrCoWiki

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SnowCait/nostr-co-wiki)

Deploy to your own Cloudflare account. Enter a Wiki signing private key in
`nsec1...` format for the required `WIKI_PRIVATE_KEY` Secret. To use administration,
set the optional `ADMIN_PUBLIC_KEY` runtime variable to the administrator’s
`npub1...` public key in the Worker’s Cloudflare Dashboard settings after the
first deployment. A first deployment creates a new Wiki Durable Object; data from
an existing deployment is not transferred.

Requires Node.js 24 or later and npm. A single Cloudflare Worker named
`nostr-co-wiki` serves SvelteKit, the Nostr Relay, and its SQLite-backed Wiki
Durable Object.

## Local development

Install dependencies with `npm install`. Set the Wiki signing key in the ignored
root `.dev.vars` file:

```text
WIKI_PRIVATE_KEY=<the Wiki's nsec1... private key>
```

Start the application with `npm run dev`, then open http://localhost:8787.
The command builds SvelteKit and runs one local Wrangler Worker. Restart it after
changing application code. The Relay is at `ws://localhost:8787/relay`. No
Cloudflare account is required for local development.

## Build and verification

```sh
npm exec playwright -- install chromium
npm run lint
npm run format:check
npm test
```

`npm test` builds SvelteKit, generates Worker types, checks TypeScript, and runs
colocated unit tests in `src/`, Workers/SQLite/Relay integration tests in
`tests/integration/` with Node’s test runner, then browser scenarios in
`tests/e2e/` with Playwright Test. Run these separately with `npm run test:unit`,
`npm run test:integration`, and `npm run test:e2e` after building. The E2E runner
stores results in `test-results/`; the screenshot scenario captures major screens
in English and Japanese at desktop and mobile sizes under its `ui-screenshots/`
output directory. Download `test-results/` from the CI run’s
`playwright-test-results` Artifact.
`npm run check` builds SvelteKit to generate translation types, generates Worker
types, and checks application and E2E types;
`npm run check:e2e` checks E2E tests and Playwright configuration with `tsc --noEmit`. Use `npm run types` after changing
Wrangler configuration; do not edit `worker-configuration.d.ts` manually.

`npm run build` uses the Cloudflare adapter. `worker.js` re-exports its generated
Worker and the Wiki Durable Object class. The Vite configuration creates a
build-only Wrangler config in `.svelte-kit`, derived from the root config, to
keep the adapter output separate from the custom entry point.

If the OS cannot run Playwright's bundled Chromium, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible installed Chromium. CI
installs a supported Chromium and system dependencies. Tests use fixture keys
and require no Cloudflare credentials.

## Public Wiki

The site supports SSR article reading, NIP-07 creation and editing, sanitized
Djot previews, history, line differences, restoration, and search. Reading does
not require a signing extension. Conflicting edits preserve the draft. After
acceptance, the editor confirms Article publication before navigating.

Browser Relay connections use the site's origin and `/relay`: HTTPS produces
`wss://`, HTTP produces `ws://`, and local port numbers are preserved. No Relay
URL environment variable is needed. Internal reads and search use the Wiki
Durable Object binding; the public `/relay` endpoint retains NIP-01/NIP-50.

## Administration and deployment settings

Open `/admin` and `/admin/articles` on the site's host. Set `ADMIN_PUBLIC_KEY`
as a runtime variable in `npub1...` format. Missing or invalid values disable
administrative access. The same-origin `/api/admin/articles` endpoint forwards
requests unchanged to the Wiki Durable Object for NIP-98 authentication,
administrator authorization, and publication-state/FTS updates.

Configure `WIKI_PRIVATE_KEY` as a Secret on `nostr-co-wiki` before deployment.
The key stays on the server. Administrator requests are signed through NIP-07;
no administrator private key, login session, or cookie is stored by the app.
Dashboard-managed runtime variables are preserved by `keep_vars`.

The single root `wrangler.json` declares the `WIKI` binding and its SQLite class
export. No separate Relay Worker deployment is needed. Existing Durable Object
data migration is outside the scope of this structure change.

### UI languages

The Web UI supports English and Japanese using sveltekit-i18n v3's SvelteKit integration. Each SSR request gets an independent instance. A manual `lang` cookie takes priority over `Accept-Language`, with English as the fallback. The footer switches language without navigating or remounting the editor. URLs and user content stay intact; dates use the selected locale with UTC.

Edit `src/lib/translations/{en,ja}/common.json`. Curly messages use `{{name}}` for interpolation and `{{number:number}}` for numeric parameters. The official typegen Vite plugin generates the ignored `src/i18n-schema.d.ts`; `npm run check` builds before checking types, and `npm test` reuses that build. No manual generation is needed after `npm ci`. `src/i18n.typecheck.ts` checks invalid keys and payloads, while unit tests compare keys and parser-defined parameters across languages. Plain Node tests import the parser's build-time extractor, without creating a rune-based i18n instance.
