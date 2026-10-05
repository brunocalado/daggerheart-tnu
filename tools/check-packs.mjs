/**
 * Validate the compendium source before it is compiled.
 *
 * Usage:
 *   node tools/check-packs.mjs
 *
 * Fails (exit 1) when a pack declared in module.json has no source directory
 * or a source directory is not declared, when a document lacks `_id` or has a
 * `_key` that doesn't end in it, when two documents in one pack share an
 * `_id`, or when a `Compendium.<module id>.<pack>.<type>.<id>` link points at
 * a document that doesn't exist. No dependencies: it runs before `npm ci`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(ROOT, "packs", "_source");

const manifest = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));
const declared = manifest.packs.map(({ name }) => name);
const problems = [];

for (const dir of readdirSync(SOURCE_ROOT)) {
  if (statSync(join(SOURCE_ROOT, dir)).isDirectory() && !declared.includes(dir)) {
    problems.push(`packs/_source/${dir} is not declared in module.json`);
  }
}

/** @type {Map<string, Set<string>>} pack name → document ids */
const ids = new Map();
/** @type {Array<{file: string, text: string}>} */
const files = [];
for (const pack of declared) {
  const dir = join(SOURCE_ROOT, pack);
  if (!existsSync(dir)) {
    problems.push(`${pack} is declared in module.json but has no packs/_source/${pack}`);
    continue;
  }
  const packIds = new Set();
  ids.set(pack, packIds);
  for (const name of readdirSync(dir).filter(file => file.endsWith(".json"))) {
    const file = `${pack}/${name}`;
    const text = readFileSync(join(dir, name), "utf8");
    let doc;
    try { doc = JSON.parse(text); } catch (error) {
      problems.push(`${file}: invalid JSON (${error.message})`);
      continue;
    }
    if (!doc._id) problems.push(`${file}: no _id`);
    else if (!doc._key?.endsWith(`!${doc._id}`)) problems.push(`${file}: _key ${doc._key} does not end in !${doc._id}`);
    if (packIds.has(doc._id)) problems.push(`${file}: duplicate _id ${doc._id}`);
    packIds.add(doc._id);
    files.push({ file, text });
  }
}

const link = new RegExp(`Compendium\\.${manifest.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.([\\w-]+)\\.\\w+\\.([A-Za-z0-9]{16})`, "g");
for (const { file, text } of files) {
  for (const [match, pack, id] of text.matchAll(link)) {
    if (!ids.get(pack)?.has(id)) problems.push(`${file}: broken link ${match}`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in the compendium source:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Compendium source OK: ${files.length} document(s) in ${ids.size} pack(s).`);
