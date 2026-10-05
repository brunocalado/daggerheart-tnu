/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Ship damage: what changes when the system's damage flow hits a ship.
 *
 * Hit Points, resistances, the damage summary and Undo stay the system's; only
 * a Stress past the ship's last slot is taken out of its hands.
 *
 * @module ship/ship-damage
 */

import { SHIP_TYPE } from "../constants.js";
import { postStressOverflow } from "./ship-actions.js";

/**
 * A Stress past the ship's last slot deactivates a module, while
 * `DhActor#modifyResource` would turn it into a Hit Point. The update is cut
 * down in place: `takeDamage` reads `resourceUpdates` after this hook, then
 * goes on to mark Hit Points, post the damage summary and keep Undo working.
 *
 * Never returns false: `DamageField.applyDamage` throws on the null that
 * `takeDamage` returns when this hook cancels it (Foundryborne/daggerheart#2464).
 *
 * Registered on `daggerheart.preTakeDamage`.
 * @param {Actor} actor
 * @param {{resourceUpdates: object[]}} args
 * @returns {void}
 */
export function onShipPreTakeDamage(actor, { resourceUpdates }) {
  if (actor.type !== SHIP_TYPE) return;
  // `resourceUpdates` is built from the keys of `args.resources`, so it holds at
  // most one Stress entry. Its value is positive: `takeDamage` flips only keys
  // without `isReversed`.
  const update = resourceUpdates.find(entry => entry.key === "stress" && !entry.clear);
  if (!update) return;
  const { value, max } = actor.system.resources.stress;
  const overflow = Math.max(0, update.value - (max - value));
  if (!overflow) return;
  update.value -= overflow;
  // Not awaited: the hook is synchronous.
  (async () => {
    for (let i = 0; i < overflow; i++) await postStressOverflow(actor);
  })();
}
