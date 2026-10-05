/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The New Unknown weapon & armor features (keywords).
 *
 * These are injected into `CONFIG.DH.ITEM.weaponFeatures` / `armorFeatures`
 * during the `init` hook. The system's `allWeaponFeatures()` /
 * `allArmorFeatures()` spread those plain objects, and the weapon/armor sheets
 * populate their feature pickers from `orderedWeaponFeatures()` /
 * `orderedArmorFeatures()` — so an `Object.assign` makes the TNU keywords
 * selectable without writing to any world setting.
 *
 * Each entry is `{ label, description }`, matching the shape of the system's
 * own descriptive features. The item description template renders
 * `{{localize feature.label}}: {{{localize feature.description}}}`, so literal
 * strings display verbatim.
 *
 * `reuse` names the base feature whose rule is word-for-word the same. At
 * `init` the entry borrows that feature's `actions`/`effects` (read live from
 * the system config, so system fixes carry over), renamed to the TNU label.
 * Keywords without `reuse` stay text only.
 *
 * Caveat: Powerful and Brutal's damage-roll modifiers are keyed by the feature
 * id in the system's `DamageRoll` (`f.value === 'powerful'`), not by its
 * effects, so Amplified and Rupture get the base action/marker but not the
 * extra die.
 *
 * @module features
 */

/**
 * TNU weapon keywords, keyed by camelCase id.
 *
 * NOTE: `barrier` and `deflecting` intentionally reuse keys that the system
 * already ships with different rules. The module targets TNU only, so
 * the TNU version wins in the merged feature list — one picker entry per name —
 * and the base rule for those keys is shadowed while this module is active.
 * `deflecting` still borrows automation, from base `parry`, whose rule it is.
 *
 * @type {Record<string, {label: string, description: string, reuse?: string}>}
 */
export const TNU_WEAPON_FEATURES = {
  precise: { label: "Precise", description: "+1 to attack rolls.", reuse: "reliable" },
  bulky: { label: "Bulky", description: "-1 to Evasion.", reuse: "heavy" },
  unwieldy: { label: "Unwieldy", description: "-1 to Finesse.", reuse: "cumbersome" },
  opportunist: {
    label: "Opportunist",
    description: "When you attack with advantage, use a larger die as your weapon damage die (see the weapon)."
  },
  flexible: {
    label: "Flexible",
    description: "When you make an attack, you can mark a Stress to target another creature within range.",
    reuse: "quick"
  },
  locked: {
    label: "Locked",
    description: "Spend a Hope to give yourself advantage on the attack roll."
  },
  hybrid: {
    label: "Hybrid",
    description: "Can also be used with an alternate trait, range, and damage die (see the weapon)."
  },
  amplified: {
    label: "Amplified",
    description: "On a successful attack, roll an additional damage die and discard the lowest result.",
    reuse: "powerful"
  },
  pointBlank: {
    label: "Point-Blank",
    description: "On a successful attack within Close range, use a larger die as your weapon damage die."
  },
  deadZone: {
    label: "Dead Zone",
    description: "Disadvantage on attack rolls at Melee and Very Close range."
  },
  straining: {
    label: "Straining",
    description: "On a successful attack, the target must mark a Stress.",
    reuse: "scary"
  },
  rupture: {
    label: "Rupture",
    description: "When you roll the maximum value on a damage die, roll an additional damage die.",
    reuse: "brutal"
  },
  adrenaline: {
    label: "Adrenaline",
    description: "When all your Stress is marked, use a larger die as your weapon damage die."
  },
  spreadfire: {
    label: "Spreadfire",
    description: "When you make an attack, target all creatures in front of you within range."
  },
  impactZone: {
    label: "Impact Zone",
    description: "Target and all creatures within Very Close range must make a Reaction Roll (13). On a success they take half damage."
  },
  tether: {
    label: "Tether",
    description: "On a successful attack, spend a Hope to temporarily Restrain the target or pull them into Melee range with you.",
    reuse: "grappling"
  },
  oneOnOne: {
    label: "One-on-One",
    description: "When no other creatures are within Close range of the target, gain advantage on your attack roll against them.",
    reuse: "dueling"
  },
  warded: { label: "Warded", description: "+1 to Armor Score." },
  lethal: {
    label: "Lethal",
    description: "When you deal Severe damage, the target must mark an additional Hit Point.",
    reuse: "deadly"
  },
  powerStrike: {
    label: "Power Strike",
    description: "Gain a bonus to your damage rolls equal to your Strength."
  },
  shockwave: {
    label: "Shockwave",
    description: "On a successful attack, all adversaries within Very Close range must mark a Stress."
  },
  // Overrides the system's base "deflecting" feature for TNU games.
  deflecting: {
    label: "Deflecting",
    description: "When you are attacked, roll this weapon's damage dice. Matching values on the attacker's dice are discarded before damage is totaled.",
    reuse: "parry"
  },
  constrict: {
    label: "Constrict",
    description: "On a successful attack, spend a Hope to temporarily Restrain them."
  },
  pull: {
    label: "Pull",
    description: "On a successful attack, you can pull yourself into Melee range of the target."
  },
  synced: {
    label: "Synced",
    description: "Spend a Hope to gain a +2 bonus to primary weapon damage."
  },
  offHand: {
    label: "Off-Hand",
    description: "+2 to primary weapon damage to targets within Melee range."
  },
  bastion: { label: "Bastion", description: "+2 to Armor Score; -1 to Evasion." },
  drag: {
    label: "Drag",
    description: "On a successful attack, you can pull the target into Melee range.",
    reuse: "hooked"
  },
  // Overrides the system's base "barrier" feature for TNU games.
  barrier: { label: "Barrier", description: "+1 to Evasion." },
  unleash: {
    label: "Unleash",
    description: "Mark a Stress to force all adversaries within Melee range back to Close range.",
    reuse: "startling"
  },
  shielded: {
    label: "Shielded",
    description: "+2 to Armor Score; -1 to a trait or resource (see the weapon)."
  },
  block: { label: "Block", description: "+1 to Armor Score." }
};

/**
 * TNU armor keywords, keyed by camelCase id. `bulky` overrides the base armor
 * feature (−1 Evasion plus Stress on Severe damage) with the TNU rule, and
 * borrows base `heavy`, whose rule it is.
 * @type {Record<string, {label: string, description: string, reuse?: string}>}
 */
export const TNU_ARMOR_FEATURES = {
  adaptive: { label: "Adaptive", description: "+1 to Evasion.", reuse: "flexible" },
  bulky: { label: "Bulky", description: "-1 to Evasion.", reuse: "heavy" },
  massive: { label: "Massive", description: "-2 to Evasion; -1 to Agility.", reuse: "veryheavy" },
  phantom: {
    label: "Phantom",
    description: "Mark an Armor Slot to give all attacks against you disadvantage until you take damage or the scene ends."
  },
  regrowth: {
    label: "Regrowth",
    description: "During downtime, automatically clear an Armor Slot.",
    reuse: "selfHealing"
  },
  biocharged: {
    label: "Biocharged",
    description: "Mark a Stress to gain a +1 bonus to your Proficiency on a primary weapon attack."
  },
  deflect: {
    label: "Deflect",
    description: "After you are hit, mark an Armor Slot to reduce the attack roll by an amount equal to your unmarked Armor Slots."
  },
  stims: {
    label: "Stims",
    description: "During downtime, automatically clear a Stress."
  },
  transfer: {
    label: "Transfer",
    description: "When you would mark a Stress, you can mark an Armor Slot instead."
  },
  cornered: {
    label: "Cornered",
    description: "When all your Stress is marked, gain advantage on attack rolls."
  }
};
