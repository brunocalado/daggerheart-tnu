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
 * A hit that would mark Hit Points while the ship has an Armor Slot left is
 * taken out of the system's hands, so the ship can be asked whether to mark
 * the slot. Every other hit stays the system's, damage summary and Undo
 * included; only a Stress past the ship's last slot is cut from it.
 *
 * @module ship/ship-damage
 */

import { SHIP_TYPE, DIALOG_CLASSES } from "../constants.js";
import { postStressOverflow } from "./ship-actions.js";

const { DialogV2 } = foundry.applications.api;

/**
 * `DhActor#takeDamage` offers an Armor Slot to characters only, and the hook
 * is synchronous, so a prompt can't wait inside the system's flow. When the
 * hit would mark Hit Points and the ship has a slot left, the hook cancels it
 * and runs the ship's flow itself. The cancelled ship drops out of the
 * system's damage summary card and its Undo, so every hit with nothing to ask
 * keeps the system's flow. The system's own `armorSlot` query is not used: its
 * dialog reads character-only fields. The hook gets no flag for direct damage,
 * so direct damage is offered the slot too and the GM declines.
 *
 * On that path a Stress past the ship's last slot deactivates a module, while
 * `DhActor#modifyResource` would turn it into a Hit Point. The update is cut
 * down in place: `takeDamage` reads `resourceUpdates` after this hook.
 *
 * Registered on `daggerheart.preTakeDamage`.
 * @param {Actor} actor
 * @param {{main: object|null, resourceUpdates: object[]}} args
 * @returns {false|void}
 */
export function onShipPreTakeDamage(actor, { main, resourceUpdates }) {
  if (actor.type !== SHIP_TYPE) return;
  // The severity as `takeDamage` computes it after this hook, resistances included.
  const hp = main ? actor.convertDamageToThreshold(actor.calculateDamage(main.value, main.damageTypes)) : 0;
  const armor = actor.system.resources.armor;
  if (hp > 0 && armor.value < armor.max) {
    // Not awaited: the hook is synchronous.
    applyAfterArmorPrompt(actor, hp, resourceUpdates.map(update => ({ ...update })));
    return false;
  }
  // Not awaited: the hook is synchronous.
  postOverflow(actor, cutStress(actor, resourceUpdates));
}

/**
 * The rest of `takeDamage` for a ship, once the Armor Slot is decided: marking
 * one drops the severity a step, as the Daggerheart armor rule does.
 * @param {Actor} ship
 * @param {number} hp - Hit Points the hit marks
 * @param {object[]} updates - a copy of the hit's other resource updates
 * @returns {Promise<void>}
 */
async function applyAfterArmorPrompt(ship, hp, updates) {
  if (await askArmorSlot(ship, hp)) {
    hp -= 1;
    add(updates, "armor", 1);
  }
  add(updates, "hitPoints", hp);
  // Cut after the prompt: the ship's Stress may have changed while it was open.
  const overflow = cutStress(ship, updates);
  // As takeDamage does before modifyResource: damage to a key without
  // isReversed, or to fear, is a loss.
  for (const update of updates) {
    const resource = ship.system.resources[update.key];
    if (update.key === "fear" || (resource && !resource.isReversed)) update.value *= -1;
  }
  await ship.modifyResource(updates.filter(update => update.value || update.clear));
  await postOverflow(ship, overflow);
}

/**
 * Adds to the update for `key`, or adds one. One entry per key:
 * `modifyResource` computes each from the stored value, so a second entry
 * for the same key would overwrite the first.
 * @param {object[]} updates
 * @param {string} key
 * @param {number} value
 * @returns {void}
 */
function add(updates, key, value) {
  const update = updates.find(entry => entry.key === key);
  if (update) update.value += value;
  else if (value) updates.push({ key, value });
}

/**
 * Ask, on the client applying the damage, whether the ship marks an Armor Slot.
 * @param {Actor} ship
 * @param {number} hp
 * @returns {Promise<boolean>}
 */
async function askArmorSlot(ship, hp) {
  return !!await DialogV2.confirm({
    // The frame sets the title as text, so the ship name needs no escaping.
    window: { title: `${ship.name}: ${hp} Hit Point(s)`, icon: "fa-solid fa-shield-halved" },
    classes: DIALOG_CLASSES,
    content: "<p>Mark an Armor Slot to reduce the severity by one?</p>"
  });
}

/**
 * Cuts the Stress update in place down to the ship's free slots.
 * @param {Actor} ship
 * @param {object[]} updates
 * @returns {number} the Stress removed
 */
function cutStress(ship, updates) {
  // `resourceUpdates` is built from the keys of `args.resources`, so it holds at
  // most one Stress entry. Its value is positive: `takeDamage` flips only keys
  // without `isReversed`.
  const update = updates.find(entry => entry.key === "stress" && !entry.clear);
  if (!update) return 0;
  const { value, max } = ship.system.resources.stress;
  const overflow = Math.max(0, update.value - (max - value));
  update.value -= overflow;
  return overflow;
}

/**
 * @param {Actor} ship
 * @param {number} count - Stress past the ship's last slot
 * @returns {Promise<void>}
 */
async function postOverflow(ship, count) {
  for (let i = 0; i < count; i++) await postStressOverflow(ship);
}
