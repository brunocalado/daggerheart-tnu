/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Hides the Daggerheart SRD from the system's Compendium Browser.
 *
 * The character creator has no item lists of its own: its ancestry, community,
 * class, subclass, domain and equipment buttons open the Compendium Browser,
 * which drops every entry the `CompendiumBrowserSettings` world setting
 * excludes. TNU ships its own pack for each of those, so excluding the system's
 * packs leaves only TNU (and world/other module) content to pick from.
 *
 * @module compendium-browser
 */

import { MODULE_ID, SYSTEM_ID, BROWSER_SETTING, SRD_HIDDEN_KEY } from "./constants.js";

/**
 * Document types the browser settings can exclude per source — the system's
 * settings dialog only offers Actor and Item packs.
 * @type {ReadonlyArray<string>}
 */
const SRD_TYPES = Object.freeze(["Item", "Actor"]);

/**
 * GM-only, run-once write that excludes the system's own packs from the
 * Compendium Browser. Merges onto the stored exclusions so choices made for
 * other sources survive, and records the run even when nothing changed, so a
 * GM who later re-enables the SRD in the browser settings keeps that choice.
 *
 * Called from the `ready` hook.
 *
 * @returns {Promise<void>} Resolves once the exclusion is applied (or skipped).
 */
export async function hideSrdFromBrowser() {
  if (!game.user.isGM || game.settings.get(MODULE_ID, SRD_HIDDEN_KEY)) return;

  const settings = game.settings.get(SYSTEM_ID, BROWSER_SETTING).toObject();
  const excluded = settings.excludedSources[SYSTEM_ID]?.excludedDocumentTypes ?? [];
  if (SRD_TYPES.some(type => !excluded.includes(type))) {
    settings.excludedSources[SYSTEM_ID] = { excludedDocumentTypes: [...new Set([...excluded, ...SRD_TYPES])] };
    await game.settings.set(SYSTEM_ID, BROWSER_SETTING, settings);
  }

  await game.settings.set(MODULE_ID, SRD_HIDDEN_KEY, true);
}
