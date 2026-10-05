/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * Homebrew preset writes for TNU.
 *
 * Most TNU config is injected into `CONFIG.DH` at runtime (domains, features,
 * conditions) and needs no world write. The currency rename is the exception:
 * the displayed currency name/label are stored *values* in the system's
 * `Homebrew` world setting, read live by the actor sheet, so the only way to
 * relabel them is to write that setting.
 *
 * The homebrew numbers TNU inherits already match the Daggerheart defaults
 * (`maxHope` = 6, `traitArray` = [2, 1, 1, 0, 0, -1]), so this module does not
 * touch them.
 *
 * @module homebrew
 */

import {
  MODULE_ID,
  SYSTEM_ID,
  HOMEBREW_SETTING,
  PRESET_VERSION_KEY,
  PRESET_VERSION,
  TNU_CURRENCY
} from "./constants.js";

/**
 * GM-only, run-once write that adapts the Daggerheart currency for TNU:
 * renames it to "Credits", labels the four coin tiers, and makes sure every
 * tier is enabled. Idempotent: it skips when the stored preset version is
 * already current, and short-circuits the write if every value already
 * matches, so it never needlessly re-triggers the system's actor re-render.
 *
 * Writing the `Homebrew` setting triggers the system's `handleChange()` →
 * `refreshConfig()` + actor re-render. Values are merged onto a `.toObject()`
 * copy so other homebrew is preserved.
 *
 * Called from the `ready` hook.
 *
 * @returns {Promise<void>} Resolves once the preset is applied (or skipped).
 */
export async function applyCurrencyPreset() {
  if (!game.user.isGM) return;

  // Run-once guard: only (re)apply when the preset version advances.
  const applied = game.settings.get(MODULE_ID, PRESET_VERSION_KEY);
  if (applied >= PRESET_VERSION) return;

  const homebrew = game.settings.get(SYSTEM_ID, HOMEBREW_SETTING).toObject();
  const currency = homebrew.currency;
  let changed = false;

  if (currency.title !== TNU_CURRENCY.title) {
    currency.title = TNU_CURRENCY.title;
    changed = true;
  }
  for (const [denomination, label] of Object.entries(TNU_CURRENCY.labels)) {
    const tier = currency[denomination];
    if (tier.label !== label || !tier.enabled) {
      tier.label = label;
      tier.enabled = true;
      changed = true;
    }
  }

  if (changed) await game.settings.set(SYSTEM_ID, HOMEBREW_SETTING, homebrew);

  // Record the applied version even when values were already correct, so this
  // does not re-check every load.
  await game.settings.set(MODULE_ID, PRESET_VERSION_KEY, PRESET_VERSION);
}
