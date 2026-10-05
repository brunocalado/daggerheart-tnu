/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The New Unknown conditions, registered as toggleable token status effects.
 *
 * The Daggerheart system rebuilds `CONFIG.statusEffects` in its own `setup`
 * hook (from `CONFIG.DH.GENERAL.conditions()`). This module's `setup` callback
 * runs afterwards and appends these entries, so they show up in the token HUD
 * status menu. Foundry status entries accept full Active-Effect data, and the
 * system's `base` effect type keeps its changes and conditionals under
 * `system`, so the automated entries carry a `system` block that becomes the
 * toggled effect's type data.
 *
 * Each entry is flagged `systemEffect: true` so the Daggerheart token HUD lists
 * it in its always-visible conditions section rather than with the generic
 * status effects.
 *
 * `Vulnerable`, `Hidden`, and `Restrained` already ship natively and are NOT
 * re-registered here.
 *
 * @module conditions
 */

/**
 * Base path for most condition icons: Foundry core `magic/*` webp art (the same
 * library the Daggerheart system uses for its own conditions), chosen
 * thematically per condition. Swap for custom art by repointing `img`.
 * @type {string}
 */
const ICONS = "icons/magic";

/**
 * An additive Active-Effect change in the system's change format.
 * @param {string} key    Data path the change targets.
 * @param {string} value  Value added to that path.
 * @returns {{key: string, type: string, value: string, phase: string}}
 */
const add = (key, value) => ({ key, type: "add", value, phase: "initial" });

/**
 * TNU status conditions. The later playtest's wording wins where they differ.
 * Dazed and Distracted automate their -2; Weakened and Confused add a roll-dialog
 * disadvantage reminder (the system's disadvantage sources are informational,
 * not applied automatically). The rest are descriptive markers that the GM and
 * players enforce narratively.
 *
 * @type {Array<{id: string, name: string, img: string, description: string, system?: object}>}
 */
export const TNU_CONDITIONS = [
  {
    id: "dazed",
    name: "Dazed",
    img: `${ICONS}/control/hypnosis-mesmerism-swirl.webp`,
    description: "When a creature is Dazed, their attack rolls have a -2 penalty.",
    system: {
      // The roll bonus is read into every d20 roll; the actionType conditional
      // limits it to attack rolls (it is evaluated at roll time).
      changes: [add("system.bonuses.roll.bonus", "-2")],
      conditionals: [{ type: "actionType", actionTypes: ["attack"] }]
    }
  },
  {
    id: "distracted",
    name: "Distracted",
    img: `${ICONS}/control/hypnosis-mesmerism-eye.webp`,
    description: "When a creature is Distracted, they have -2 penalty to their Difficulty or Evasion. (Automated for Evasion only: lower an adversary's Difficulty by hand.)",
    system: {
      // Evasion only. An add change on a path the actor lacks is not skipped —
      // it creates the property — and roll targets resolve `difficulty ?? evasion`,
      // so a `system.difficulty` change would give a Distracted character a
      // Difficulty of -2 and make every attack against them hit. Conditionals
      // gate the whole effect, not one change, so the two can't share a status.
      changes: [add("system.evasion", "-2")]
    }
  },
  {
    id: "weakened",
    name: "Weakened",
    img: `${ICONS}/death/hand-withered-gray.webp`,
    description: "When a creature is Weakened, they have disadvantage on attack rolls.",
    system: { changes: [add("system.disadvantageSources", "Weakened: attack rolls")] }
  },
  {
    id: "stunned",
    name: "Stunned",
    img: `${ICONS}/lightning/bolt-forked-large-blue.webp`,
    description: "When a creature is Stunned, they can't use reactions and can't take any other action."
  },
  {
    id: "shrouded",
    name: "Shrouded",
    // A concealing mist — kept distinct from the native Hidden icon
    // (magic/perception/silhouette-stealth-shadow.webp), which it otherwise resembles.
    img: `${ICONS}/air/fog-gas-smoke-dense-gray.webp`,
    description: "When a creature is Shrouded, it is also Hidden. In addition to the benefits of the Hidden condition, while Shrouded a creature remains unseen if stationary when an adversary moves to where they would normally see them."
  },
  // Conditions defined inside card and adversary text — markers, GM-enforced.
  {
    id: "tormented",
    name: "Tormented",
    img: `${ICONS}/death/undead-ghost-scream-teal.webp`,
    description: "Whenever a Tormented creature is spotlighted, they must also mark a Stress."
  },
  {
    id: "ignited",
    name: "Ignited",
    img: `${ICONS}/fire/explosion-embers-evade-silhouette.webp`,
    description: "While Ignited, a creature takes 2d6 energy damage if they are still Ignited at the end of their action."
  },
  {
    id: "panicked",
    name: "Panicked",
    // A fear-energy spirit (outside the ICONS base). Avoids the fright mask, which
    // is the Daggerheart system's default "defeated" combat icon.
    img: "icons/creatures/magical/spirit-fear-energy-pink.webp",
    description: "A Panicked creature must attempt to flee, moving as far away from the source as possible. The GM must spotlight them after the source was spotlighted."
  },
  {
    id: "frenzied",
    name: "Frenzied",
    img: `${ICONS}/control/fear-fright-monster-grin-red-orange.webp`,
    description: "A Frenzied creature attacks the closest target, striking friend and foe alike. The GM must spotlight them after the source was spotlighted."
  },
  {
    id: "ordered",
    name: "Ordered",
    img: `${ICONS}/control/control-influence-puppet.webp`,
    description: "While Ordered, a creature gains advantage on attack rolls. Ordered ends when they roll with Fear."
  },
  {
    id: "infested",
    name: "Infested",
    img: "icons/environment/creatures/bug-worm-glow.webp",
    description: "When a creature acts while Infested, they take d6 kinetic damage, using the source's Proficiency. If an Infested creature marks their last Hit Point, the biotic organism ruptures: all creatures within Very Close range must make a Reaction Roll (13). Targets who fail take d20+5 kinetic damage using the source's Proficiency. Targets who succeed take half damage."
  },
  {
    id: "slowed",
    name: "Slowed",
    img: `${ICONS}/time/hourglass-tilted-gray.webp`,
    description: "While Slowed, a creature can't act yet when spotlighted. Instead place a token on them and describe what they're preparing to do. When they are spotlighted again and have a token on them, clear the token and they can act."
  },
  {
    id: "terrified",
    name: "Terrified",
    img: `${ICONS}/control/fear-fright-shadow-monster-purple.webp`,
    description: "While Terrified, a creature replaces their Hope Die with a d8 until they roll a success with Hope."
  },
  {
    id: "confused",
    name: "Confused",
    img: `${ICONS}/control/hypnosis-mesmerism-watch.webp`,
    description: "While Confused, a creature is Vulnerable, can't move beyond Very Close range as normal movement, and has disadvantage on action rolls. Confused ends when they mark a Hit Point.",
    system: { changes: [add("system.disadvantageSources", "Confused: action rolls")] }
  },
  {
    id: "saturated",
    name: "Saturated",
    img: `${ICONS}/unholy/orb-colllecting-energy-green.webp`,
    description: "A Saturated Entity holds stored energy that its Superdense Flash can release. It is no longer Saturated once that energy is released."
  }
].map(condition => ({
  ...condition,
  systemEffect: true
}));
