/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Sheets for ship modules and ship cards. The system unregisters the core item
 * sheet and registers its own for its types only, so these item types have no
 * sheet unless the module provides one. They wear the system's item-sheet
 * classes, so the portrait header, tabs and description editor look like the
 * system's own items.
 *
 * @module ship/ship-item-sheets
 */

import { MODULE_ID, SPHERE_LABELS } from "../constants.js";
import { prepareShipActions } from "../helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATES = `modules/${MODULE_ID}/templates/ship`;

class ShipItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["daggerheart", "sheet", "dh-style", "item", MODULE_ID, "ship-item-sheet"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "description", label: "Description" },
        { id: "details", label: "Details" },
        { id: "features", label: "Features" }
      ],
      initial: "description"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.item.system;
    return Object.assign(context, {
      system,
      systemFields: system.schema.fields,
      tabs: this._prepareTabs("primary"),
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description, {
        relativeTo: this.item,
        secrets: this.item.isOwner
      }),
      actions: prepareShipActions(this.item)
    });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }
}

export class ShipModuleSheet extends ShipItemSheet {
  static PARTS = {
    header: { template: `${TEMPLATES}/item-header.hbs` },
    description: { template: `${TEMPLATES}/item-description.hbs`, scrollable: [".description-section"] },
    details: { template: `${TEMPLATES}/module-details.hbs`, scrollable: [""] },
    features: { template: `${TEMPLATES}/item-features.hbs`, scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { capacity, deactivated } = this.item.system;
    context.placeholder = "Module name";
    context.subtitle = [
      "Ship Module",
      `Capacity ${capacity}`,
      deactivated ? "Deactivated" : null
    ].filter(Boolean).join(" · ");
    return context;
  }
}

export class ShipCardSheet extends ShipItemSheet {
  static PARTS = {
    header: { template: `${TEMPLATES}/item-header.hbs` },
    description: { template: `${TEMPLATES}/item-description.hbs`, scrollable: [".description-section"] },
    details: { template: `${TEMPLATES}/card-details.hbs`, scrollable: [""] },
    features: { template: `${TEMPLATES}/item-features.hbs`, scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { sphere, level, location, owner } = this.item.system;
    context.placeholder = "Card name";
    context.sphereChoices = SPHERE_LABELS;
    context.ownerName = owner ? foundry.utils.fromUuidSync(owner)?.name ?? "Missing actor" : "";
    context.subtitle = [
      `${SPHERE_LABELS[sphere]} Ship Card`,
      `Level ${level}`,
      location ? `Used from the ${location}` : null
    ].filter(Boolean).join(" · ");
    return context;
  }
}
