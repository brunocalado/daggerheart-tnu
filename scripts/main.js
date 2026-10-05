/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The New Unknown (Daggerheart) — module entry point.
 *
 * Wiring overview:
 * - `init`  — register the run-once preset setting, then inject TNU domains and
 *             weapon/armor features into `CONFIG.DH`. This MUST happen in `init`,
 *             before `Game.initializeDocuments()` validates world items: the
 *             `domainCard` `domain` field validates against `allDomains()`, so a
 *             stored TNU domain (e.g. "terra") would otherwise be rejected and
 *             abort world setup. (`CONFIG.DH` is assigned at the system's module
 *             top level, so it already exists when `init` fires.) The ship
 *             document sub-types register their data models and sheets here too.
 * - `setup` — append TNU conditions to `CONFIG.statusEffects` and give the ship
 *             its token bar attributes. This MUST happen in `setup`, after the
 *             system's own `setup` hook rebuilds `CONFIG.statusEffects` and
 *             `CONFIG.Actor.trackableAttributes` from scratch; the module's
 *             callback runs after the system's because the module ESM loads
 *             after the system ESM.
 * - `ready` — apply the GM-only, run-once currency preset, and hide the SRD
 *             from the Compendium Browser (also run-once).
 * - `renderChatMessageHTML` — wire the module buttons of a ship's Stress
 *             overflow card.
 *
 * The i18n relabels (Trauma, Power Trait, Kinetic/Energy) are applied
 * automatically by Foundry from `lang/en.json`, which loads after — and so
 * overrides — the system's language file.
 *
 * @module main
 */

import {
  MODULE_ID,
  PRESET_VERSION_KEY,
  SRD_HIDDEN_KEY,
  SHIP_TYPE,
  SHIP_MODULE_TYPE,
  SHIP_CARD_TYPE
} from "./constants.js";
import { TNU_DOMAINS } from "./domains.js";
import { TNU_WEAPON_FEATURES, TNU_ARMOR_FEATURES } from "./features.js";
import { TNU_CONDITIONS } from "./conditions.js";
import { applyCurrencyPreset } from "./homebrew.js";
import { hideSrdFromBrowser } from "./compendium-browser.js";
import { ShipModel } from "./ship/ship-model.js";
import { ShipModuleModel } from "./ship/ship-module-model.js";
import { ShipCardModel } from "./ship/ship-card-model.js";
import { ShipSheet, SHIP_ACTIONS_PARTIAL } from "./ship/ship-sheet.js";
import { ShipModuleSheet, ShipCardSheet } from "./ship/ship-item-sheets.js";
import { bindStressOverflowCard } from "./ship/ship-actions.js";

/**
 * Register the module-scoped world settings that keep the currency write and
 * the SRD browser exclusion run-once.
 *
 * Called from the `init` hook.
 * @returns {void}
 */
function registerSettings() {
  game.settings.register(MODULE_ID, PRESET_VERSION_KEY, {
    name: "TNU homebrew preset version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  game.settings.register(MODULE_ID, SRD_HIDDEN_KEY, {
    name: "TNU SRD hidden from the Compendium Browser",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
}

/**
 * Merge TNU domains and weapon/armor features into the live system config.
 * Runs in `init` (see module-level note) so stored items that reference them
 * pass validation during document initialization.
 *
 * - Domains → the plain `CONFIG.DH.DOMAIN.domains` object that `allDomains()`
 *   reads live (and that the `domainCard` field validates against).
 * - Features → the plain `CONFIG.DH.ITEM.weaponFeatures` / `armorFeatures`
 *   objects that `allWeaponFeatures()` / `allArmorFeatures()` read live
 *   (see `injectFeatures`).
 *
 * @returns {void}
 */
function injectDomainsAndFeatures() {
  Object.assign(CONFIG.DH.DOMAIN.domains, TNU_DOMAINS);
  injectFeatures(CONFIG.DH.ITEM.weaponFeatures, TNU_WEAPON_FEATURES);
  injectFeatures(CONFIG.DH.ITEM.armorFeatures, TNU_ARMOR_FEATURES);
}

/**
 * Write TNU keywords into a system feature dictionary. A keyword with `reuse`
 * borrows the base feature's `actions`/`effects`, renamed to the TNU keyword so
 * a Precise weapon doesn't show a "Reliable" effect. The base entries are
 * captured first because some TNU keys overwrite base keys.
 *
 * @param {Record<string, object>} target - `weaponFeatures` or `armorFeatures`
 * @param {Record<string, object>} features - the TNU keywords
 * @returns {void}
 */
function injectFeatures(target, features) {
  const base = { ...target };
  const rename = (list, { label, description }) => list?.map(entry => ({ ...entry, name: label, description }));
  for (const [key, { reuse, ...feature }] of Object.entries(features)) {
    const source = reuse ? base[reuse] : null;
    if (reuse && !source) console.warn(`${MODULE_ID} | base feature "${reuse}" not found for "${key}"`);
    target[key] = source
      ? { ...feature, actions: rename(source.actions, feature), effects: rename(source.effects, feature) }
      : feature;
  }
}

/**
 * Append the TNU conditions to `CONFIG.statusEffects` so they appear in the
 * token HUD status menu. Runs in `setup`, after the system's `setup` hook has
 * rebuilt the array.
 *
 * @returns {void}
 */
function injectConditions() {
  CONFIG.statusEffects.push(...TNU_CONDITIONS);
}

/**
 * Register the data models of the module's document sub-types (declared under
 * `documentTypes` in module.json). Runs in `init`, before world documents are
 * initialized.
 *
 * @returns {void}
 */
function registerShipModels() {
  Object.assign(CONFIG.Actor.dataModels, { [SHIP_TYPE]: ShipModel });
  Object.assign(CONFIG.Item.dataModels, { [SHIP_MODULE_TYPE]: ShipModuleModel, [SHIP_CARD_TYPE]: ShipCardModel });
}

/**
 * Register the ship and ship item sheets. The system unregisters the core
 * actor and item sheets and registers its own for its types only, so the
 * module's types have no sheet without these.
 *
 * @returns {void}
 */
function registerShipSheets() {
  // The feature list is one partial shared by the Modules and Cards tabs.
  foundry.applications.handlebars.loadTemplates({
    [SHIP_ACTIONS_PARTIAL]: `modules/${MODULE_ID}/templates/ship/actions.hbs`
  });
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, MODULE_ID, ShipSheet,
    { types: [SHIP_TYPE], makeDefault: true, label: "TNU Ship" });
  DocumentSheetConfig.registerSheet(foundry.documents.Item, MODULE_ID, ShipModuleSheet,
    { types: [SHIP_MODULE_TYPE], makeDefault: true, label: "TNU Ship Module" });
  DocumentSheetConfig.registerSheet(foundry.documents.Item, MODULE_ID, ShipCardSheet,
    { types: [SHIP_CARD_TYPE], makeDefault: true, label: "TNU Ship Card" });
}

/**
 * Give ship tokens their bar and value attributes. Without an entry, core
 * offers the union of every actor type's attributes.
 *
 * @returns {void}
 */
function registerShipTrackables() {
  CONFIG.Actor.trackableAttributes[SHIP_TYPE] = {
    bar: ["resources.hitPoints", "resources.stress", "resources.hope", "resources.armor"],
    value: ["evasion", "proficiency", "damageThresholds.major", "damageThresholds.severe"]
  };
}

Hooks.once("init", () => {
  registerSettings();
  injectDomainsAndFeatures();
  registerShipModels();
  registerShipSheets();
});
Hooks.once("setup", () => {
  injectConditions();
  registerShipTrackables();
});
Hooks.once("ready", () => {
  applyCurrencyPreset();
  hideSrdFromBrowser();
});
Hooks.on("renderChatMessageHTML", bindStressOverflowCard);
