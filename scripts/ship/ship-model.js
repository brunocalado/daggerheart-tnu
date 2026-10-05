/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Data model for the ship actor: a hull with its own tracks, Evasion and
 * thresholds, played jointly by the crew like an additional PC.
 *
 * The system's damage code runs on any actor that carries the fields it reads,
 * so an adversary attack against a ship token hits against `evasion` and marks
 * Hit Points by `damageThresholds` with no ship-specific code.
 *
 * @module ship/ship-model
 */

import { SHIP_TYPE, SHIP_MODULE_TYPE, SHIP_CARD_TYPE } from "../constants.js";
import { postShipBeyondRepair } from "./ship-actions.js";

// The system's BaseDataActor is not exported; DhEnvironment extends it
// directly. `CONFIG.Actor.dataModels` is assigned at the system's module top
// level, so it is in place when this module is evaluated. DhCreature is not
// used: its resources come from `CONFIG.DH.RESOURCE[type]`, a module namespace
// that cannot take a new key.
const BaseDataActor = Object.getPrototypeOf(CONFIG.Actor.dataModels.environment);

const { SchemaField, NumberField, ArrayField, StringField, DocumentUUIDField, BooleanField } = foundry.data.fields;

const track = initial => new SchemaField({
  value: new NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 }),
  max: new NumberField({ required: true, nullable: false, initial, integer: true, min: 0 })
});

/**
 * Prepared onto each resource, as DhCreature does from `CONFIG.DH.RESOURCE`.
 * `takeDamage` flips the sign of any resource without `isReversed`, so without
 * it a hit would clear marked Hit Points instead of marking them; scrolling
 * text reads `label`.
 */
const RESOURCE_DATA = {
  hitPoints: { label: "DAGGERHEART.GENERAL.HitPoints.plural", isReversed: true },
  stress: { label: "DAGGERHEART.GENERAL.stress", isReversed: true },
  hope: { label: "DAGGERHEART.GENERAL.hope", isReversed: false },
  armor: { label: "DAGGERHEART.GENERAL.armorSlots", isReversed: true }
};

/**
 * What reaching each tier grants on its own, before the crew's two options:
 * Armor Slots and damage threshold raises, cumulative across tiers.
 * @type {Readonly<Record<string, {level: number, armor: number, major: number, severe: number}>>}
 */
export const TIER_GAINS = Object.freeze({
  tier2: { level: 2, armor: 1, major: 7, severe: 13 },
  tier3: { level: 5, armor: 1, major: 5, severe: 10 },
  tier4: { level: 8, armor: 1, major: 5, severe: 12 }
});

/**
 * The tier-up options the crew picks two of at tiers 2, 3 and 4, mapped to the
 * stat each raises by 1. `experience` is a choice every player makes on their
 * own ship Experience, so it raises no stat.
 */
const TIER_OPTIONS = {
  proficiency: "proficiency",
  hitPoint: "resources.hitPoints.max",
  stress: "resources.stress.max",
  evasion: "evasion",
  experience: null
};

export class ShipModel extends BaseDataActor {
  static get metadata() {
    return foundry.utils.mergeObject(super.metadata, {
      label: `TYPES.Actor.${SHIP_TYPE}`,
      type: SHIP_TYPE,
      // The crew plays the ship as an additional PC, so it sits with the
      // characters in the combat tracker and spotlight queue.
      isNPC: false,
      hasResistances: true,
      hasInventory: false,
      usesSize: false
    });
  }

  static defineSchema() {
    return {
      ...super.defineSchema(),
      // Never name a field `type`: the encounter Battle Points code reads any
      // actor's `system.type` as an adversary type.
      hull: new StringField({ required: true, blank: true }),
      level: new NumberField({ required: true, nullable: false, initial: 1, min: 1, max: 10, integer: true }),
      proficiency: new NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0 }),
      // No `difficulty`: roll targets resolve `difficulty ?? evasion`, and the
      // ship is hit against its Evasion.
      evasion: new NumberField({ required: true, nullable: false, initial: 10, integer: true }),
      damageThresholds: new SchemaField({
        major: new NumberField({ required: true, nullable: false, initial: 9, integer: true }),
        severe: new NumberField({ required: true, nullable: false, initial: 18, integer: true })
      }),
      resources: new SchemaField({ hitPoints: track(14), stress: track(8), hope: track(5), armor: track(4) }),
      // Read by the attack damage path; missing, every hit becomes NaN and marks 1 HP.
      // BaseDataActor declares no `rules`: the system spreads `commonActorRules()`
      // into the character and adversary schemas only.
      rules: new SchemaField({
        attack: new SchemaField({
          damage: new SchemaField({
            hpDamageTakenMultiplier: new NumberField({ required: true, nullable: false, initial: 1 })
          })
        })
      }),
      experiences: new ArrayField(new SchemaField({
        name: new StringField({ required: true, blank: true }),
        value: new NumberField({ required: true, nullable: false, initial: 2, integer: true })
      })),
      crew: new ArrayField(new SchemaField({
        actor: new DocumentUUIDField({ type: "Actor" }),
        module: new StringField({ required: true, blank: true })
      })),
      tierOptions: new SchemaField(Object.fromEntries([2, 3, 4].map(tier => [
        `tier${tier}`,
        new SchemaField(Object.fromEntries(Object.keys(TIER_OPTIONS).map(option => [option, new BooleanField()])))
      ])))
    };
  }

  /**
   * The stored stats are the hull's own, as built at level 1; the tier gains and
   * the options checked on reached tiers are added here, before Active Effects
   * apply, so lowering the level or unchecking an option takes them back off.
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();
    for (const [key, data] of Object.entries(RESOURCE_DATA)) Object.assign(this.resources[key], data);
    for (const [path, bonus] of Object.entries(this.tierBonuses)) {
      foundry.utils.setProperty(this, path, foundry.utils.getProperty(this, path) + bonus);
    }
  }

  /** @override */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    // One shared vessel: its tokens act on the actor itself. The system's
    // DhActor#_preCreate only links tokens for the types it knows.
    if (data.prototypeToken?.actorLink === undefined) {
      this.parent.updateSource({
        prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY }
      });
    }
  }

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (userId !== game.user.id) return;
    const hitPoints = changed.system?.resources?.hitPoints?.value;
    if (hitPoints !== undefined && hitPoints >= this.resources.hitPoints.max) {
      postShipBeyondRepair(this.parent, "Every Hit Point is marked");
    }
  }

  /** @override */
  isItemValid(source) {
    return [SHIP_MODULE_TYPE, SHIP_CARD_TYPE].includes(source.type);
  }

  /**
   * Marks or clears Armor Slots. `DhActor#modifyResource` routes the `armor`
   * key here instead of to `resources`, and throws if the method is missing.
   * @param {{value?: number, clear?: boolean}} change
   * @returns {Promise<void>}
   */
  async updateArmorValue({ value: change = 0, clear = false }) {
    const armor = this.resources.armor;
    const value = clear ? 0 : Math.clamp(armor.value + change, 0, armor.max);
    if (value !== armor.value) await this.parent.update({ "system.resources.armor.value": value });
  }

  /**
   * Reaches formulas as `@tier`: the inherited `getRollData` proxies this
   * prepared model, so roll data also sees the tier gains and Active Effects.
   * @type {number}
   */
  get tier() {
    return this.level >= 8 ? 4 : this.level >= 5 ? 3 : this.level >= 2 ? 2 : 1;
  }

  /**
   * Stat raises from the tiers reached, keyed by path under `system`. Read from
   * `level` and `tierOptions` only, so it is the same before and after
   * preparation.
   * @type {Record<string, number>}
   */
  get tierBonuses() {
    const bonuses = {};
    const add = (path, amount) => bonuses[path] = (bonuses[path] ?? 0) + amount;
    for (const [tier, gains] of Object.entries(TIER_GAINS)) {
      if (this.level < gains.level) continue;
      add("resources.armor.max", gains.armor);
      add("damageThresholds.major", gains.major);
      add("damageThresholds.severe", gains.severe);
      for (const [option, path] of Object.entries(TIER_OPTIONS)) {
        if (path && this.tierOptions[tier][option]) add(path, 1);
      }
    }
    return bonuses;
  }

  /** The GM's budget for a ship fight: Hit Points plus Armor Score. */
  get battlePoints() {
    return this.resources.hitPoints.max + this.resources.armor.max;
  }
}
