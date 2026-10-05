/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Data model for a ship module: one room of the hull.
 *
 * @module ship/ship-module-model
 */

import { SHIP_TYPE, SHIP_MODULE_TYPE } from "../constants.js";
import { shipActionsField } from "./ship-actions-field.js";
import { postShipBeyondRepair } from "./ship-actions.js";

// The system's BaseDataItem is not exported; DHFeature extends it directly.
// `CONFIG.Item.dataModels` is assigned at the system's module top level, so it
// is in place when this module is evaluated. Extending it keeps
// `getLinkedItems()`, which `DhItem.deleteDocuments` calls on every item.
const BaseDataItem = Object.getPrototypeOf(CONFIG.Item.dataModels.feature);

const { SchemaField, NumberField, StringField, BooleanField } = foundry.data.fields;

/** A ship module: capacity, the module it replaces, an optional stat line, actions. */
export class ShipModuleModel extends BaseDataItem {
  static get metadata() {
    return foundry.utils.mergeObject(super.metadata, {
      label: `TYPES.Item.${SHIP_MODULE_TYPE}`,
      type: SHIP_MODULE_TYPE,
      hasDescription: true
    });
  }

  static defineSchema() {
    return {
      ...super.defineSchema(),
      capacity: new NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0 }),
      replaces: new StringField({ required: true, blank: true }),
      // Set when ship Stress overflows; the module's actions are unusable until the next rest.
      deactivated: new BooleanField(),
      // The printed stat line, only on modules that attack or move on their own
      // (the cannons). Not `attack`: system sheets and dialogs read
      // `system.attack` on any item as an Action.
      stats: new SchemaField({
        bonus: new NumberField({ nullable: true, initial: null, integer: true }),
        range: new StringField({ nullable: true, initial: null, choices: CONFIG.DH.GENERAL.range }),
        damage: new StringField({ required: true, blank: true })
      }),
      shipActions: shipActionsField()
    };
  }

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const ship = this.parent.parent;
    if (userId !== game.user.id || changed.system?.deactivated !== true || ship?.type !== SHIP_TYPE) return;
    if (ship.itemTypes[SHIP_MODULE_TYPE].every(module => module.system.deactivated)) {
      postShipBeyondRepair(ship, "Every module is deactivated");
    }
  }
}
