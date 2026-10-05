/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Shared, dependency-free constants for the TNU module.
 *
 * This file is a leaf module: it imports nothing from the rest of the module,
 * so it can be imported anywhere without circular-import risk.
 *
 * @module constants
 */

/**
 * Module id — the single source of truth, identical to the `id` in module.json.
 * Used verbatim for module setting registration and `game.modules.get()`.
 * @type {string}
 */
export const MODULE_ID = "daggerheart-tnu";

/**
 * The Daggerheart system id this module extends. Used to read/write the
 * system's `Homebrew` world setting and to build system asset paths.
 * @type {string}
 */
export const SYSTEM_ID = "daggerheart";

/**
 * Key of the world setting (registered by the Daggerheart system) that holds the
 * `DhHomebrew` data model.
 * @type {string}
 */
export const HOMEBREW_SETTING = "Homebrew";

/**
 * Key of the module-scoped world setting that records the last applied
 * homebrew-preset version, used to keep {@link applyCurrencyPreset} run-once.
 * Renamed from `presetVersion`: worlds that ran the earlier preset (which turned
 * the coin tiers off) store a version under the old key, so the new key makes
 * the current preset apply once to them too.
 * @type {string}
 */
export const PRESET_VERSION_KEY = "currencyPreset";

/**
 * Current homebrew-preset version. Bump this whenever the values written by
 * `applyCurrencyPreset()` change, so the GM-only, run-once write re-applies on
 * the next world load (but not on every load).
 * @type {number}
 */
export const PRESET_VERSION = 1;

/**
 * Key of the world setting (registered by the Daggerheart system) that holds the
 * `CompendiumBrowserSettings` data model — the sources and packs the system's
 * Compendium Browser (and so the character creator) leaves out.
 * @type {string}
 */
export const BROWSER_SETTING = "CompendiumBrowserSettings";

/**
 * Key of the module-scoped world setting that records whether the SRD has
 * already been hidden from the Compendium Browser, keeping that write run-once
 * so a GM who re-enables the SRD in the browser settings keeps that choice.
 * @type {string}
 */
export const SRD_HIDDEN_KEY = "srdHidden";

/**
 * Sci-fi currency written into the Daggerheart `Homebrew` setting. `title` is
 * the overall currency name; `labels` names each coin tier. All four tiers stay
 * enabled — TNU prices things in tiers too ("a chest full of credits").
 * @type {Readonly<{title: string, labels: Readonly<Record<string, string>>}>}
 */
export const TNU_CURRENCY = Object.freeze({
  title: "Credits",
  labels: Object.freeze({
    coins: "Credits",
    handfuls: "Handfuls",
    bags: "Bags",
    chests: "Chests"
  })
});

/**
 * Module sub-type ids. Foundry names a module's document sub-types
 * `<module id>.<sub-type>`, from the `documentTypes` block in module.json.
 * @type {string}
 */
export const SHIP_TYPE = `${MODULE_ID}.ship`;
/** @type {string} */
export const SHIP_MODULE_TYPE = `${MODULE_ID}.shipModule`;
/** @type {string} */
export const SHIP_CARD_TYPE = `${MODULE_ID}.shipCard`;

/**
 * Ship Spheres and the Power Traits that place a crew member in each.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const SPHERE_TRAITS = Object.freeze({
  mind: Object.freeze(["finesse", "knowledge"]),
  heart: Object.freeze(["presence", "instinct"]),
  fist: Object.freeze(["agility", "strength"])
});

/**
 * Display names of the ship Spheres.
 * @type {Readonly<Record<string, string>>}
 */
export const SPHERE_LABELS = Object.freeze({ mind: "Mind", heart: "Heart", fist: "Fist" });

/**
 * How a ship action is resolved, with its label and its icon on the ship sheet.
 * `none` covers passive and narrative features, `rest` the cabins, where the
 * ship recovers its once-per-rest features. The keys are the `roll` choices of
 * the ship action schema.
 * @type {Readonly<Record<string, Readonly<{label: string, icon: string}>>>}
 */
export const SHIP_ROLL_TYPES = Object.freeze({
  power: Object.freeze({ label: "Power Roll", icon: "fa-solid fa-dice" }),
  attack: Object.freeze({ label: "Attack Roll", icon: "fa-solid fa-crosshairs" }),
  reaction: Object.freeze({ label: "Reaction Roll", icon: "fa-solid fa-shield-halved" }),
  none: Object.freeze({ label: "No roll", icon: "fa-solid fa-bolt" }),
  rest: Object.freeze({ label: "Rest", icon: "fa-solid fa-bed" })
});

/**
 * The ship resources a ship action can cost, by ship resource key. The keys are
 * the `costs` fields of the ship action schema.
 * @type {Readonly<Record<string, string>>}
 */
export const SHIP_COST_LABELS = Object.freeze({ hope: "Hope", stress: "Stress", hitPoints: "HP", armor: "Armor Slot" });

/**
 * When a once-per ship action recovers. The keys, plus "" for an action usable
 * at will, are the `oncePer` choices of the ship action schema.
 * @type {Readonly<Record<string, string>>}
 */
export const SHIP_ONCE_PER_LABELS = Object.freeze({ rest: "Once per rest", longRest: "Once per long rest" });
