/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The ship actor sheet, laid out like the system's character sheet: a
 * sidebar with the portrait, tracks, hull stats and Experiences; a header
 * with the name, level, hull, tier and Hope; and four tabs — Modules, Crew,
 * Cards and Tier-up.
 *
 * Built on core ActorSheetV2 rather than the system's DHBaseActorSheet: the
 * system base wires inventory, settings and limited view from its own
 * `metadata` and expects a character or adversary context. The system's look
 * is borrowed through its CSS classes instead (see DEFAULT_OPTIONS.classes).
 *
 * @module ship/ship-sheet
 */

import { MODULE_ID, SHIP_MODULE_TYPE, SHIP_CARD_TYPE, SPHERE_LABELS } from "../constants.js";
import { sphereOf, isCardLocation, prepareShipActions } from "../helpers.js";
import { useShipAction } from "./ship-actions.js";
import { TIER_GAINS } from "./ship-model.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATES = `modules/${MODULE_ID}/templates/ship`;

/** Handlebars partial name of the feature list shared by modules and cards. */
export const SHIP_ACTIONS_PARTIAL = `${MODULE_ID}.ship-actions`;

const TRACK_LABELS = { hitPoints: "HP", stress: "Stress" };


const TIER_OPTION_LABELS = {
  proficiency: "+1 Proficiency",
  hitPoint: "+1 Hit Point slot",
  stress: "+1 Stress slot",
  evasion: "+1 Evasion",
  experience: "New Experience at +2, or +1 to one"
};

export class ShipSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    // The system keys its whole look to `daggerheart sheet dh-style actor`:
    // frame, fonts, inputs, buttons, pips and tab navigation come from its
    // stylesheet. MODULE_ID and `ship-sheet` scope the module's own rules.
    classes: ["daggerheart", "sheet", "dh-style", "actor", MODULE_ID, "ship-sheet"],
    position: { width: 820, height: 740 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      setTrack: ShipSheet.#onSetTrack,
      toggleModule: ShipSheet.#onToggleModule,
      removeCrew: ShipSheet.#onRemoveCrew,
      openCrew: ShipSheet.#onOpenCrew,
      useAction: ShipSheet.#onUseAction,
      addExperience: ShipSheet.#onAddExperience,
      removeExperience: ShipSheet.#onRemoveExperience,
      openItem: ShipSheet.#onOpenItem,
      deleteItem: ShipSheet.#onDeleteItem
    }
  };

  static PARTS = {
    sidebar: { template: `${TEMPLATES}/sidebar.hbs`, scrollable: [".shortcut-items-section"] },
    header: { template: `${TEMPLATES}/header.hbs` },
    modules: { template: `${TEMPLATES}/modules.hbs`, scrollable: [".tab-scroll"] },
    crew: { template: `${TEMPLATES}/crew.hbs`, scrollable: [".tab-scroll"] },
    cards: { template: `${TEMPLATES}/cards.hbs`, scrollable: [".tab-scroll"] },
    tierUp: { template: `${TEMPLATES}/tier-up.hbs`, scrollable: [".tab-scroll"] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "modules", label: "Modules" },
        { id: "crew", label: "Crew" },
        { id: "cards", label: "Cards" },
        { id: "tierUp", label: "Tier-up" }
      ],
      initial: "modules"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    const crew = system.crew.map(entry => {
      const actor = foundry.utils.fromUuidSync(entry.actor);
      const sphere = sphereOf(actor);
      const trait = actor?.system?.spellcastModifierTrait?.key;
      const traitLabel = CONFIG.DH.ACTOR.abilities?.[trait]?.label;
      return {
        uuid: entry.actor,
        module: entry.module,
        name: actor?.name ?? "Missing actor",
        img: actor?.img ?? CONST.DEFAULT_TOKEN,
        sphere,
        sphereLabel: SPHERE_LABELS[sphere] ?? "No sphere",
        traitLabel: traitLabel ? game.i18n.localize(traitLabel) : ""
      };
    });

    const modules = this.actor.itemTypes[SHIP_MODULE_TYPE]
      .toSorted((a, b) => a.sort - b.sort)
      .map(item => {
        const members = crew.filter(member => member.module === item.id);
        const { bonus, range, damage } = item.system.stats;
        const statLine = damage ? [
          bonus === null ? null : `ATK ${bonus >= 0 ? "+" : ""}${bonus}`,
          range ? game.i18n.localize(CONFIG.DH.GENERAL.range[range].label) : null,
          damage
        ].filter(Boolean).join(" · ") : "";
        return {
          item,
          members,
          statLine,
          full: members.length >= item.system.capacity,
          actions: prepareShipActions(item, item.system.deactivated)
        };
      });

    // Crew rows offer every module, so a member can be moved with the select.
    const moduleChoices = modules.map(({ item, members }) => ({
      id: item.id,
      label: `${item.name} (${members.length}/${item.system.capacity})`
    }));
    for (const member of crew) member.choices = moduleChoices;

    const useResourcePips = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.appearance).useResourcePips;

    return Object.assign(context, {
      system,
      tabs: this._prepareTabs("primary"),
      isToken: this.actor.isToken,
      useResourcePips,
      tier: system.tier,
      battlePoints: system.battlePoints,
      tracks: Object.entries(TRACK_LABELS).map(([key, label]) => this.#prepareTrack(key, label)),
      hope: this.#prepareTrack("hope", "Hope"),
      armor: this.#prepareTrack("armor", "Armor Slots"),
      spheres: Object.entries(SPHERE_LABELS).map(([key, label]) => ({
        key, label, count: crew.filter(member => member.sphere === key).length
      })),
      crew,
      modules,
      cardGroups: this.#prepareCards(modules, crew),
      experiences: system.experiences.map((experience, index) => ({ ...experience, index })),
      tierRows: Object.entries(system.tierOptions).map(([tier, options]) => {
        const { level, armor, major, severe } = TIER_GAINS[tier];
        // The crew picks two per tier: the rest lock once two are checked.
        const full = Object.values(options).filter(Boolean).length >= 2;
        return {
          title: `Tier ${tier.at(-1)}`,
          level,
          gains: `+${armor} Armor Slot · Thresholds +${major} / +${severe}`,
          reached: system.level >= level,
          options: Object.entries(options).map(([key, checked]) => ({
            name: `system.tierOptions.${tier}.${key}`,
            label: TIER_OPTION_LABELS[key],
            checked,
            disabled: !this.isEditable || (full && !checked)
          }))
        };
      })
    });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  /**
   * @param {string} key - ship resource key
   * @param {string} label
   * @returns {{key: string, label: string, value: number, max: number, pips: object[]}}
   */
  #prepareTrack(key, label) {
    const { value, max } = this.actor.system.resources[key];
    return {
      key, label, value, max,
      pips: Array.from({ length: max }, (_, i) => ({ value: i + 1, filled: i < value }))
    };
  }

  /**
   * Ship cards grouped by owner. There is no vault: every card is always
   * available. A card's actions are disabled while the module it is used from
   * (matched by name, or by the module a replacement stands in for) is
   * deactivated.
   * @param {object[]} modules
   * @param {object[]} crew
   * @returns {object[]}
   */
  #prepareCards(modules, crew) {
    const owners = crew.map(({ uuid, name }) => ({ uuid, name }));
    const groups = new Map();
    for (const item of this.actor.itemTypes[SHIP_CARD_TYPE]) {
      const owner = owners.find(o => o.uuid === item.system.owner);
      const key = owner?.uuid ?? "";
      if (!groups.has(key)) groups.set(key, { name: owner?.name ?? "Unassigned", cards: [] });
      const location = modules.find(({ item: module }) => isCardLocation(module, item.system.location));
      const locationDown = !!location?.item.system.deactivated;
      groups.get(key).cards.push({
        item,
        sphere: item.system.sphere,
        sphereLabel: SPHERE_LABELS[item.system.sphere],
        locationDown,
        locationMissing: !location,
        owners: owners.map(o => ({ ...o, selected: o.uuid === item.system.owner })),
        actions: prepareShipActions(item, locationDown)
      });
    }
    // Owned groups first, unassigned cards last.
    return [...groups.entries()].sort(([a], [b]) => !a - !b).map(([, group]) => group);
  }

  /**
   * Every number input shows a prepared value — the hull's own plus tier gains
   * plus Active Effects — while the actor stores the hull's own. Each submitted
   * number goes back as the stored value moved by the edit made to the shown
   * one, so neither a tier gain nor an effect (a Distracted ship's -2 Evasion)
   * is written into the hull. `submitOnChange` sends every field, so without
   * this, any edit would bake them in. The prepared values are the ones the
   * form was rendered with, even when this submit also changes the level or an
   * option.
   * @override
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const source = this.actor.system.toObject();
    for (const [path, value] of Object.entries(foundry.utils.flattenObject(data.system ?? {}))) {
      const shown = foundry.utils.getProperty(this.actor.system, path);
      if (typeof value !== "number" || typeof shown !== "number") continue;
      foundry.utils.setProperty(data.system, path, foundry.utils.getProperty(source, path) + value - shown);
    }
    return data;
  }

  /**
   * The crew-module and card-owner selects carry no `name`, so they never reach
   * the actor update; each one updates its own target here.
   * @override
   */
  _onChangeForm(formConfig, event) {
    const target = event.target;
    if (target.dataset.crewUuid) return this.#assignCrew(target.dataset.crewUuid, target.value);
    if (target.dataset.cardOwner) {
      const card = this.actor.items.get(target.dataset.cardOwner);
      return card?.update({ "system.owner": target.value || null });
    }
    return super._onChangeForm(formConfig, event);
  }

  /**
   * Move a crew member into a module, or out of every module with "".
   * @param {string} uuid - the crew member's actor UUID
   * @param {string} moduleId - embedded ship module id, or ""
   * @returns {Promise<void>}
   */
  async #assignCrew(uuid, moduleId) {
    const crew = this.actor.system.toObject().crew;
    const member = crew.find(entry => entry.actor === uuid);
    if (!member || member.module === moduleId) return;
    const module = this.actor.items.get(moduleId);
    if (module) {
      const occupied = crew.filter(entry => entry.module === moduleId).length;
      if (occupied >= module.system.capacity) {
        ui.notifications.warn(`${module.name} is full (capacity ${module.system.capacity}).`);
        return this.render({ parts: ["crew"] });
      }
    }
    member.module = module ? moduleId : "";
    await this.actor.update({ "system.crew": crew });
  }

  /**
   * Dropping a character adds it to the crew, into the module it is dropped on
   * when that module has room.
   * @override
   */
  async _onDropActor(event, actor) {
    if (!this.isEditable) return null;
    if (actor.type !== "character" || actor.pack) {
      ui.notifications.warn("Only characters from this world can join the crew.");
      return null;
    }
    const crew = this.actor.system.toObject().crew;
    if (crew.some(entry => entry.actor === actor.uuid)) {
      ui.notifications.info(`${actor.name} is already aboard.`);
      return null;
    }
    const module = this.actor.items.get(event.target.closest("[data-item-id]")?.dataset.itemId);
    let moduleId = "";
    if (module?.type === SHIP_MODULE_TYPE) {
      const occupied = crew.filter(entry => entry.module === module.id).length;
      if (occupied < module.system.capacity) moduleId = module.id;
      else ui.notifications.warn(`${module.name} is full (capacity ${module.system.capacity}); ${actor.name} boards unassigned.`);
    }
    crew.push({ actor: actor.uuid, module: moduleId });
    await this.actor.update({ "system.crew": crew });
    return actor;
  }

  /**
   * Pips toggle as on the system's sheets: clicking pip N marks N, clicking a
   * marked pip clears it and everything above it.
   */
  static async #onSetTrack(event, target) {
    const { track } = target.dataset;
    const pip = Number(target.dataset.value);
    const { value } = this.actor.system.resources[track];
    await this.actor.update({ [`system.resources.${track}.value`]: value >= pip ? pip - 1 : pip });
  }

  static async #onToggleModule(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    await item?.update({ "system.deactivated": !item.system.deactivated });
  }

  static async #onRemoveCrew(event, target) {
    const crew = this.actor.system.toObject().crew;
    const index = crew.findIndex(entry => entry.actor === target.dataset.crewUuid);
    if (index === -1) return;
    crew.splice(index, 1);
    await this.actor.update({ "system.crew": crew });
  }

  static #onOpenCrew(event, target) {
    foundry.utils.fromUuidSync(target.dataset.uuid)?.sheet.render({ force: true });
  }

  static async #onUseAction(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    await useShipAction(this.actor, item, Number(target.dataset.actionIndex), event);
  }

  static async #onAddExperience() {
    const experiences = this.actor.system.toObject().experiences;
    experiences.push({ name: "New Experience", value: 2 });
    await this.actor.update({ "system.experiences": experiences });
  }

  static async #onRemoveExperience(event, target) {
    const experiences = this.actor.system.toObject().experiences;
    // Experiences have no id. If another user changed the list since this
    // render, the index may point at a different one: re-render instead.
    const index = Number(target.dataset.index);
    if (experiences[index]?.name !== target.dataset.name) return this.render();
    experiences.splice(index, 1);
    await this.actor.update({ "system.experiences": experiences });
  }

  static #onOpenItem(event, target) {
    this.actor.items.get(target.closest("[data-item-id]").dataset.itemId)?.sheet.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    // Crew in a deleted module stays aboard and shows as unassigned.
    await item?.deleteDialog();
  }
}
