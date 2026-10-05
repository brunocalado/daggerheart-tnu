/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Ship play: a crew member uses a feature of a ship module or ship card.
 *
 * Aboard, the crew set their own sheets aside and only their Power Trait is
 * used, while everything spent or gained belongs to the ship. So the roll is
 * the crew member's own duality roll (`DhActor#diceRoll`, as the system's
 * companion sheet does for its partner), and the resource updates the system
 * queues for it are applied to the ship instead of the roller. Fear still goes
 * to the GM.
 *
 * @module ship/ship-actions
 */

import { MODULE_ID, SHIP_MODULE_TYPE, SHIP_CARD_TYPE, SPHERE_LABELS } from "../constants.js";
import { sphereOf, isCardLocation, shipCostLabel } from "../helpers.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

const CHAT_CARD = `modules/${MODULE_ID}/templates/ship/chat-card.hbs`;
const ROLL_PROMPT = `modules/${MODULE_ID}/templates/ship/roll-prompt.hbs`;

// The system styles any DialogV2 carrying these classes like its own dialogs.
const DIALOG_CLASSES = ["daggerheart", "dialog", "dh-style", MODULE_ID];

const REST_LABELS = { rest: "Short Rest", longRest: "Long Rest" };

/**
 * Use one feature of a ship module or ship card.
 *
 * Costs are charged when the roll succeeds, because nearly every printed cost
 * reads "on a success, spend…"; an action without a roll pays at once. When
 * success can't be judged (no target and no fixed difficulty) the costs are
 * charged and the GM adjusts.
 *
 * @param {Actor} ship
 * @param {Item} item - an embedded ship module or ship card
 * @param {number} index - position in `item.system.shipActions`
 * @param {Event} [event] - the click, so modifier keys skip the roll dialog as elsewhere
 * @returns {Promise<void>}
 */
export async function useShipAction(ship, item, index, event) {
  const action = item?.system.shipActions[index];
  if (!action) return;
  if (!ship.isOwner) return warn(`You need owner permission on ${ship.name} to use its features.`);
  if (action.used) {
    return warn(`${action.name} has been used. It recovers on the next ${action.oncePer === "longRest" ? "long rest" : "rest"}.`);
  }

  // A module's features are used from that module; a card's from the module
  // named by its location, or one that replaces it.
  const locations = item.type === SHIP_MODULE_TYPE ? [item]
    : ship.itemTypes[SHIP_MODULE_TYPE].filter(module => isCardLocation(module, item.system.location));
  const active = locations.filter(module => !module.system.deactivated);
  if (!active.length) {
    return warn(locations.length ? `${locations[0].name} is deactivated until the next rest.` : `${ship.name} has no ${item.system.location}.`);
  }

  const inPlace = ship.system.crew
    .filter(entry => active.some(module => module.id === entry.module))
    .map(entry => foundry.utils.fromUuidSync(entry.actor))
    .filter(actor => actor?.isOwner);
  if (!inPlace.length) return warn(`None of your crew is in ${active.map(module => module.name).join(" or ")}.`);

  // Two crew members of the same Sphere may use each other's cards; the
  // borrower pays 1 ship Hope. This replaces Help an Ally aboard.
  const owner = item.type === SHIP_CARD_TYPE ? item.system.owner : null;
  const eligible = inPlace.filter(actor => !owner || actor.uuid === owner || sphereOf(actor) === item.system.sphere);
  if (!eligible.length) {
    return warn(`${item.name} belongs to another crew member. Only a ${SPHERE_LABELS[item.system.sphere]} crew member can borrow it.`);
  }

  const rolls = !["none", "rest"].includes(action.roll);
  const choice = await chooseCrew(ship, item, action, eligible, rolls);
  if (!choice) return;
  const { crew, experiences } = choice;
  const sphere = sphereOf(crew);
  if (rolls && !sphere) return warn(`${crew.name} has no Power Trait, so no Sphere to act from.`);

  if (action.roll === "rest") return shipRest(ship, action);

  // Checked before rolling against the worst case, so a success never finds
  // the ship unable to pay. Stress may overflow: that deactivates a module.
  const borrowed = !!owner && owner !== crew.uuid;
  const { hope, armor } = ship.system.resources;
  const hopeNeeded = experiences.length + Number(borrowed) + action.costs.hope;
  if (hopeNeeded > hope.value) return warn(`${ship.name} has ${hope.value} Hope and this needs ${hopeNeeded}.`);
  if (action.costs.armor > armor.max - armor.value) return warn(`${ship.name} has no Armor Slot left to mark.`);

  const deltas = { hope: -(experiences.length + Number(borrowed)) };
  let result = null;
  if (rolls) {
    const targets = action.difficulty === null
      ? Array.from(game.user.targets, token => game.system.api.fields.ActionFields.TargetField.formatTarget(token))
      : [];
    result = await crew.diceRoll({
      event,
      title: `${item.name}: ${action.name}`,
      headerTitle: `${ship.name}: ${crew.name}`,
      hasRoll: true,
      actionType: action.roll === "reaction" ? "reaction" : "action",
      roll: {
        trait: crew.system.spellcastModifierTrait.key,
        difficulty: action.difficulty ?? undefined,
        // A feature tagged for another Sphere is used with disadvantage.
        advantage: action.spheres.has(sphere) ? 0 : -1,
        baseModifiers: experiences.map(({ name, value }) => ({ label: name, value }))
      },
      ...(targets.length ? { hasTarget: true, targets } : {})
    });
    if (!result) return;

    // Hope, the crit's cleared Stress and Fear, as queued by the system's
    // Hope/Fear automation. Fear is not a ship resource: modifyResource sends
    // it to the GM's tracker whatever actor it is called on.
    for (const { key, value } of result.resourceUpdates.values()) add(deltas, key, value ?? 0);
    // The crew member's own Experiences picked in the roll dialog; their Hope
    // is spent from the ship like any other Hope aboard.
    const { CostField } = game.system.api.fields.ActionFields;
    for (const cost of CostField.getRealCosts(result.costs)) {
      const resource = ship.system.resources[cost.key];
      if (resource) add(deltas, cost.key, (cost.total ?? cost.value) * (resource.isReversed ? 1 : -1));
    }
  }

  const succeeded = result?.roll.success !== false;
  if (succeeded) {
    for (const [key, value] of Object.entries(action.costs)) add(deltas, key, key === "hope" ? -value : value);
  }
  await payShip(ship, deltas);

  if (action.oncePer) {
    const actions = item.system.toObject().shipActions;
    actions[index].used = true;
    await item.update({ "system.shipActions": actions });
  }

  if (!rolls) {
    const paid = shipCostLabel(action.costs);
    await postCard({ actor: crew }, `${item.name}: ${action.name}`, [
      action.description,
      ...(paid ? [`${ship.name} pays ${paid}.`] : [])
    ]);
  }

  if (action.damage && succeeded) await rollShipDamage(item, action, event);
}

/**
 * Pick the acting crew member when more than one could act, and the ship
 * Experiences to add to a roll. The user's own character is picked without
 * asking when it is in place.
 * @returns {Promise<{crew: Actor, experiences: object[]}|null>} null when dismissed
 */
async function chooseCrew(ship, item, action, eligible, rolls) {
  const own = eligible.find(actor => actor === game.user.character);
  const crew = own ? [own] : eligible;
  const experiences = rolls && ship.system.resources.hope.value > 0 ? ship.system.experiences : [];
  if (crew.length === 1 && !experiences.length) return { crew: crew[0], experiences: [] };

  const content = await renderTemplate(ROLL_PROMPT, {
    chooseCrew: crew.length > 1,
    crew: crew.map(actor => ({ uuid: actor.uuid, name: actor.name, sphere: SPHERE_LABELS[sphereOf(actor)] ?? "No sphere" })),
    experiences: experiences.map((experience, index) => ({ ...experience, index })),
    hope: ship.system.resources.hope.value
  });
  const data = await DialogV2.input({
    window: { title: `${item.name}: ${action.name}`, icon: "fa-solid fa-dice" },
    classes: DIALOG_CLASSES,
    content,
    ok: { label: rolls ? "Roll" : "Use" }
  });
  if (!data) return null;
  return {
    crew: crew.find(actor => actor.uuid === data.crew) ?? crew[0],
    experiences: experiences.filter((_, index) => data[`experience${index}`])
  };
}

/** @param {object} deltas @param {string} key @param {number} value */
function add(deltas, key, value) {
  deltas[key] = (deltas[key] ?? 0) + value;
}

/**
 * Apply signed changes to the ship: positive marks Stress, Hit Points and
 * Armor Slots and gains Hope; `fear` goes to the GM.
 *
 * A Stress beyond the last slot is held back here: `DhActor#modifyResource`
 * would turn it into a marked Hit Point, while aboard a ship it deactivates a
 * module instead.
 * @param {Actor} ship
 * @param {Record<string, number>} deltas
 * @returns {Promise<void>}
 */
async function payShip(ship, deltas) {
  const stress = ship.system.resources.stress;
  const overflow = Math.max(0, (deltas.stress ?? 0) - (stress.max - stress.value));
  if (overflow) deltas.stress -= overflow;
  const resources = Object.entries(deltas).filter(([, value]) => value).map(([key, value]) => ({ key, value }));
  if (resources.length) await ship.modifyResource(resources);
  for (let i = 0; i < overflow; i++) await postStressOverflow(ship);
}

/**
 * The system's standalone damage card, as its damage enricher builds it: the
 * GM applies it to the targets from the card.
 * @returns {Promise<void>}
 */
async function rollShipDamage(item, action, event) {
  const { TargetField } = game.system.api.fields.ActionFields;
  await CONFIG.Dice.daggerheart.DamageRoll.build({
    event,
    title: `${item.name}: ${action.name}`,
    data: { bonuses: [] },
    source: {},
    hasDamage: true,
    hasTarget: true,
    targets: Array.from(game.user.targets, token => TargetField.formatTarget(token)),
    // Ship damage is kinetic, which TNU maps onto the system's physical type.
    damageFormula: {
      formula: action.damage,
      applyTo: CONFIG.DH.GENERAL.healingTypes.hitPoints.id,
      damageTypes: ["physical"]
    },
    resourceFormulas: []
  });
}

/**
 * The crew rests in the cabins. Nothing happens to the crew here; they take
 * their rest from their own sheets. The ship recovers its once-per-rest
 * features and reactivates every module.
 * @returns {Promise<void>}
 */
async function shipRest(ship, action) {
  const rest = await DialogV2.wait({
    window: { title: `${ship.name}: ${action.name}`, icon: "fa-solid fa-bed" },
    classes: DIALOG_CLASSES,
    content: "<p>Which rest does the crew take?</p>",
    buttons: Object.entries(REST_LABELS).map(([key, label]) => ({ action: key, label }))
  });
  if (!rest) return;
  const recovers = rest === "longRest" ? ["rest", "longRest"] : ["rest"];

  const updates = [];
  const reactivated = [];
  for (const part of [...ship.itemTypes[SHIP_MODULE_TYPE], ...ship.itemTypes[SHIP_CARD_TYPE]]) {
    const update = { _id: part.id };
    const actions = part.system.toObject().shipActions;
    if (actions.some(entry => entry.used && recovers.includes(entry.oncePer))) {
      update["system.shipActions"] = actions.map(entry => recovers.includes(entry.oncePer) ? { ...entry, used: false } : entry);
    }
    if (part.system.deactivated) {
      update["system.deactivated"] = false;
      reactivated.push(part.name);
    }
    if (Object.keys(update).length > 1) updates.push(update);
  }
  if (updates.length) await ship.updateEmbeddedDocuments("Item", updates);

  await postCard({ actor: ship }, `${ship.name}: ${REST_LABELS[rest]}`, [
    action.description,
    `${ship.name}'s once-per-${rest === "longRest" ? "long-rest" : "rest"} features recover.`,
    ...(reactivated.length ? [`Reactivated: ${reactivated.join(", ")}.`] : [])
  ]);
}

/**
 * Ship Stress overflowed: the GM picks the module that goes down.
 * @param {Actor} ship
 * @returns {Promise<void>}
 */
async function postStressOverflow(ship) {
  const modules = ship.itemTypes[SHIP_MODULE_TYPE].filter(module => !module.system.deactivated);
  await postCard({ actor: ship }, `${ship.name}: Stress overflow`, [
    `${ship.name}'s last Stress is marked and it needs another. Deactivate a module until the next rest:`
  ], {
    buttons: modules.map(module => ({ uuid: module.uuid, label: module.name })),
    whisper: foundry.documents.ChatMessage.getWhisperRecipients("GM").map(user => user.id),
    flags: { [MODULE_ID]: { stressOverflow: true } }
  });
}

/**
 * Posted when every Hit Point is marked or every module is deactivated.
 * @param {Actor} ship
 * @param {string} reason
 * @returns {Promise<void>}
 */
export async function postShipBeyondRepair(ship, reason) {
  await postCard({ actor: ship }, `${ship.name} is beyond repair`, [
    `${reason}. A new ship costs a chest full of credits per player.`
  ]);
}

/**
 * Wires the module buttons of a Stress overflow card. Only a GM can press them.
 * Registered on `renderChatMessageHTML`.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @returns {void}
 */
export function bindStressOverflowCard(message, html) {
  if (!message.getFlag(MODULE_ID, "stressOverflow")) return;
  for (const button of html.querySelectorAll("[data-module-uuid]")) {
    button.disabled = !game.user.isGM;
    button.addEventListener("click", async () => {
      const module = await foundry.utils.fromUuid(button.dataset.moduleUuid);
      if (!module || module.system.deactivated) return warn("That module is already gone or deactivated.");
      await module.update({ "system.deactivated": true });
      const content = await renderTemplate(CHAT_CARD, {
        title: `${module.parent.name}: Stress overflow`,
        lines: [`${module.name} is deactivated until the next rest.`]
      });
      await message.update({ content });
    });
  }
}

/**
 * @param {{actor: Actor}} speaker
 * @param {string} title
 * @param {string[]} lines - plain text, escaped by the template
 * @param {{buttons?: object[], whisper?: string[], flags?: object}} [options]
 * @returns {Promise<ChatMessage>}
 */
async function postCard({ actor }, title, lines, { buttons = [], whisper, flags } = {}) {
  return foundry.documents.ChatMessage.implementation.create({
    speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
    content: await renderTemplate(CHAT_CARD, { title, lines, buttons }),
    whisper,
    flags
  });
}

/** @param {string} message @returns {void} */
function warn(message) {
  ui.notifications.warn(message);
}
