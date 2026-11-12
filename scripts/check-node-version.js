import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const required = readFileSync(
  new URL("../.node-version", import.meta.url),
  "utf8",
).trim();
const runtime = process.versions.node;
const types = createRequire(import.meta.url)(
  "@types/node/package.json",
).version;

if (runtime.split(".")[0] !== required || types.split(".")[0] !== required) {
  console.error(
    `Node.js major version mismatch: .node-version=${required}, Node.js=${runtime}, @types/node=${types}`,
  );
  process.exitCode = 1;
}
