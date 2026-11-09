import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';

test('Workers serve SSR and connect to the Relay-owned SQLite Durable Object', { timeout: 90000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nostr-co-wiki-'));
  let child;
  let stopped;
  let spawnError;
  t.after(async () => {
    try {
      if (child && child.exitCode === null && child.signalCode === null && !spawnError) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
        await stopped;
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  const web = JSON.parse(await readFile('apps/web/wrangler.json', 'utf8'));
  const relay = JSON.parse(await readFile('apps/relay/wrangler.json', 'utf8'));
  assert.deepEqual(relay.exports.Wiki, { type: 'durable-object', storage: 'sqlite' });
  // Only the test entry point exposes binding probes; the application has no debug routes.
  await writeFile(join(directory, 'worker.js'), `
    import web from ${JSON.stringify(resolve('apps/web/.svelte-kit/cloudflare/_worker.js'))};
    export default {
      async fetch(request, env, ctx) {
        if (new URL(request.url).pathname === '/__bindings') {
          const object = await env.WIKI.getByName('wiki').fetch('https://wiki.invalid/');
          return Response.json({ object: object.status });
        }
        return web.fetch(request, env, ctx);
      }
    };
  `);
  await writeFile(join(directory, 'wrangler.json'), JSON.stringify({
    ...web,
    main: join(directory, 'worker.js'),
    assets: { ...web.assets, directory: resolve('apps/web/.svelte-kit/cloudflare') }
  }));
  let output = '';
  child = spawn(resolve('node_modules/.bin/wrangler'), [
    'dev', '-c', join(directory, 'wrangler.json'), '-c', resolve('apps/relay/wrangler.json'),
    '--port', '18787', '--persist-to', join(directory, 'state'), '--inspector-port', '0'
  ], { detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  stopped = new Promise(resolve => {
    child.once('exit', resolve);
    child.once('error', error => { spawnError = error; resolve(); });
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  let response;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(output);
    try { response = await fetch('http://localhost:18787/'); break; } catch { await setTimeout(500); }
  }
  assert.ok(response, output);
  assert.equal(response.status, 200, output);
  const html = await response.text();
  assert.match(html, /<h1>NostrCoWiki<\/h1>/);
  const bindings = await fetch('http://localhost:18787/__bindings');
  assert.equal(bindings.status, 200, await bindings.clone().text());
  assert.deepEqual(await bindings.json(), { object: 404 });
});
