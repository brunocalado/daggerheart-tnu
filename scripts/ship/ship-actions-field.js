/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The action list carried by ship modules and ship cards.
 *
 * These are not system actions: a system action rolls as its item's parent
 * actor, which for a ship-embedded item is the ship — no trait, never the crew
 * member's Power Trait. Ship play reads this list with its own roll flow.
 * The models store it as `shipActions`, never `actions`: the system treats
 * `system.actions` on any item as its own Action collection
 * (`DhItem#prepareEmbeddedDocuments` calls `prepareData()` on each entry).
 *
 * @module ship/ship-actions-field
 */

import { SPHERE_TRAITS, SHIP_ROLL_TYPES, SHIP_COST_LABELS, SHIP_ONCE_PER_LABELS } from "../constants.js";

const { ArrayField, SchemaField, SetField, StringField, NumberField, BooleanField } = foundry.data.fields;

/** Resource marks or spends an action costs the ship, by ship resource key. */
const cost = () => new NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 });

/**
 * @returns {foundry.data.fields.ArrayField} One entry per printed feature.
 */
export function shipActionsField() {
  return new ArrayField(new SchemaField({
    name: new StringField({ required: true, blank: false }),
    // The Spheres that use it without disadvantage. Untagged features list all three.
    spheres: new SetField(new StringField({ choices: Object.keys(SPHERE_TRAITS) })),
    roll: new StringField({ required: true, choices: Object.keys(SHIP_ROLL_TYPES), initial: "power" }),
    // A fixed difficulty; null rolls against the target (or a difficulty the GM sets).
    difficulty: new NumberField({ nullable: true, initial: null, integer: true }),
    costs: new SchemaField(Object.fromEntries(Object.keys(SHIP_COST_LABELS).map(key => [key, cost()]))),
    damage: new StringField({ required: true, blank: true }),
    oncePer: new StringField({ required: true, blank: true, choices: ["", ...Object.keys(SHIP_ONCE_PER_LABELS)] }),
    // A once-per action already used since the rest that recovers it.
    used: new BooleanField(),
    description: new StringField({ required: true, blank: true })
  }));
}
