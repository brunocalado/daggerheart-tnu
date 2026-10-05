/**
 * Compile (or extract) the module's compendium packs with the Foundry VTT CLI.
 *
 * Usage:
 *   node tools/build-packs.mjs pack      # JSON source  -> LevelDB packs
 *   node tools/build-packs.mjs unpack    # LevelDB packs -> JSON source
 *
 * Source documents live as JSON in `packs/_source/<pack>/`; compiled LevelDB
 * packs are written to `packs/<pack>/` (the paths declared in module.json).
 *
 * Both directions are clean rebuilds, so a document deleted on one side
 * doesn't linger on the other. `unpack` regenerates the JSON source from the
 * compiled packs (handy after editing content inside Foundry) and keeps each
 * existing document's file name, so the git diff shows content changes rather
 * than renames; a new document gets `<type>_<Name>_<id>.json`.
 *
 * Requires `npm install` first (pulls @foundryvtt/foundryvtt-cli).
 */

import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(ROOT, "packs", "_source");
const PACK_ROOT = join(ROOT, "packs");

const mode = process.argv[2];
if (!["pack", "unpack"].includes(mode)) {
  console.error("Usage: node tools/build-packs.mjs <pack|unpack>");
  process.exit(1);
}

// The packs declared in module.json, not whatever directories exist.
const packs = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8")).packs.map(({ name }) => name);

/**
 * File names of the documents already in a source directory, by `_id`.
 * @param {string} dir
 * @returns {Map<string, string>}
 */
function existingNames(dir) {
  if (!existsSync(dir)) return new Map();
  return new Map(readdirSync(dir).filter(file => file.endsWith(".json")).map(file =>
    [JSON.parse(readFileSync(join(dir, file), "utf8"))._id, file]
  ));
}

/**
 * `<type>_<Name>_<id>.json`, as the existing source files are named: the
 * document subtype without a module prefix, or the collection for documents
 * without one (folders, tables, journal).
 */
function newName(doc, collection) {
  const type = doc.type?.split(".").pop() ?? collection;
  const name = (doc.name ?? "").replace(/'/g, "").replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_|_$/g, "");
  return `${type}_${name}_${doc._id}.json`;
}

for (const name of packs) {
  const source = join(SOURCE_ROOT, name);
  const dest = join(PACK_ROOT, name);
  if (!existsSync(mode === "pack" ? source : dest)) {
    console.warn(`Skipping ${name}: ${mode === "pack" ? source : dest} does not exist.`);
    continue;
  }
  if (mode === "pack") {
    rmSync(dest, { recursive: true, force: true }); // clean rebuild
    await compilePack(source, dest, { log: true });
  } else {
    // Read before `clean` empties the directory.
    const names = existingNames(source);
    await extractPack(dest, source, {
      log: true,
      clean: true,
      transformName: doc => names.get(doc._id) ?? newName(doc, doc._key.split("!")[1])
    });
  }
}

console.log(`\n${mode} complete: ${packs.length} pack(s).`);
