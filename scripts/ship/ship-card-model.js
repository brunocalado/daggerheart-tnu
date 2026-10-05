/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Data model for a ship domain card (Sphere card).
 *
 * @module ship/ship-card-model
 */

import { SHIP_CARD_TYPE, SPHERE_TRAITS } from "../constants.js";
import { shipActionsField } from "./ship-actions-field.js";

// BaseDataItem through DHFeature, as in ship-module-model.js.
const BaseDataItem = Object.getPrototypeOf(CONFIG.Item.dataModels.feature);

const { StringField, NumberField, DocumentUUIDField } = foundry.data.fields;

/** A ship domain card: its Sphere, level, the module it is used from, its owner. */
export class ShipCardModel extends BaseDataItem {
  static get metadata() {
    return foundry.utils.mergeObject(super.metadata, {
      label: `TYPES.Item.${SHIP_CARD_TYPE}`,
      type: SHIP_CARD_TYPE,
      hasDescription: true
    });
  }

  static defineSchema() {
    return {
      ...super.defineSchema(),
      sphere: new StringField({ required: true, choices: Object.keys(SPHERE_TRAITS), initial: "mind" }),
      level: new NumberField({ required: true, nullable: false, initial: 3, integer: true, min: 1, max: 10 }),
      // "Locational": the module a crew member must be in to use the card.
      location: new StringField({ required: true, blank: true }),
      owner: new DocumentUUIDField({ type: "Actor" }),
      shipActions: shipActionsField()
    };
  }
}
