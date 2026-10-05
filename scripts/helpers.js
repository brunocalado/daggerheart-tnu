/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Shared helpers for the TNU module.
 *
 * @module helpers
 */

import {
  SPHERE_TRAITS,
  SPHERE_LABELS,
  SHIP_ROLL_TYPES,
  SHIP_COST_LABELS,
  SHIP_ONCE_PER_LABELS
} from "./constants.js";

/**
 * The ship Sphere a crew member acts from, derived from their Power Trait.
 * Daggerheart's character model resolves the Power Trait from the actor's
 * subclasses (`spellcastModifierTrait`), so a character without a subclass —
 * or any non-character actor — has no Sphere.
 *
 * @param {Actor} actor
 * @returns {string|null} "mind" | "heart" | "fist", or null
 */
export function sphereOf(actor) {
  const trait = actor?.system?.spellcastModifierTrait?.key;
  if (!trait) return null;
  return Object.keys(SPHERE_TRAITS).find(sphere => SPHERE_TRAITS[sphere].includes(trait)) ?? null;
}

/**
 * Whether a ship module is the place a ship card's `location` names: the module
 * of that name, or one that replaces it. Matched by name, so renaming a module
 * unlinks the cards used from it.
 *
 * @param {Item} module - a ship module
 * @param {string} location - a ship card's `system.location`
 * @returns {boolean}
 */
export function isCardLocation(module, location) {
  return [module.name, module.system.replaces].includes(location);
}

/**
 * The costs of a ship action as text, e.g. "1 Hope, 2 Stress"; "" when free.
 *
 * @param {Record<string, number>} costs - a ship action's `costs`
 * @returns {string}
 */
export function shipCostLabel(costs) {
  return Object.entries(costs).filter(([, value]) => value)
    .map(([key, value]) => `${value} ${SHIP_COST_LABELS[key]}`).join(", ");
}

/**
 * Display data for the feature list of a ship module or ship card, shared by
 * the ship sheet and the ship item sheets.
 *
 * @param {Item} item - a ship module or ship card
 * @param {boolean} [deactivated] - the module the actions are used from is deactivated
 * @returns {object[]}
 */
export function prepareShipActions(item, deactivated = false) {
  return item.system.shipActions.map((action, index) => ({
    ...action,
    index,
    rollLabel: SHIP_ROLL_TYPES[action.roll]?.label ?? action.roll,
    icon: SHIP_ROLL_TYPES[action.roll]?.icon ?? SHIP_ROLL_TYPES.none.icon,
    disabled: deactivated || action.used,
    sphereTags: Array.from(action.spheres, key => ({ key, label: SPHERE_LABELS[key] })),
    costLabel: shipCostLabel(action.costs),
    damageLabel: action.damage ? `${action.damage} kinetic` : "",
    oncePerLabel: SHIP_ONCE_PER_LABELS[action.oncePer] ?? ""
  }));
}
