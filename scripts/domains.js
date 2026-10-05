/*!
 * The New Unknown (Daggerheart)
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
/**
 * The New Unknown planetary domains.
 *
 * These are injected into `CONFIG.DH.DOMAIN.domains` during the `init` hook.
 * The system's `allDomains()` reads that plain object live (it spreads it into
 * the `domainCard` domain dropdown choices), so a simple `Object.assign` makes
 * the TNU domains selectable without writing to any world setting.
 *
 * Entry shape mirrors the system's base domains: `{ id, label, src, description,
 * color }`. `color` tints the domain card banner and trim; `invertText` switches
 * that text to dark for light colors.
 * `label`/`description` are displayed as-is (literal strings pass through
 * `game.i18n.localize` unchanged). Labels are kept to the planet name only so
 * the domain dropdown stays compact; the epithet lives in the description.
 *
 * @module domains
 */

import { SYSTEM_ID } from "./constants.js";

/**
 * Base path of the system's domain icon SVGs. TNU domains reuse thematically
 * close system icons so the domain card never shows a broken image; drop custom
 * art in the module and repoint `src` to replace them.
 * @type {string}
 */
const DOMAIN_ICONS = `systems/${SYSTEM_ID}/assets/icons/domains`;

/**
 * The ten TNU domains: three each in the Mind, Heart, and Fist spheres, plus
 * Nibiru, which stands outside the spheres.
 * @type {Record<string, {id: string, label: string, src: string, description: string, color: string, invertText?: boolean}>}
 */
export const TNU_DOMAINS = {
  // --- Sphere of Mind ---
  mercury: {
    id: "mercury",
    label: "Mercury",
    src: `${DOMAIN_ICONS}/splendor.svg`,
    description: "The Impulse — the skill domain of mobility and tactical warfare.",
    color: "#3f7f9e"
  },
  saturn: {
    id: "saturn",
    label: "Saturn",
    src: `${DOMAIN_ICONS}/midnight.svg`,
    description: "The Shadow — the tech domain of stealth and deception.",
    color: "#4a4458"
  },
  uranus: {
    id: "uranus",
    label: "Uranus",
    src: `${DOMAIN_ICONS}/codex.svg`,
    description: "The Spark — the tech domain of experimental gear and improvisation.",
    color: "#2f7f86"
  },
  // --- Sphere of Heart ---
  pluto: {
    id: "pluto",
    label: "Pluto",
    src: `${DOMAIN_ICONS}/bone.svg`,
    description: "The End — the tech or psionic domain of entropy and burden.",
    color: "#5c3a3a"
  },
  venus: {
    id: "venus",
    label: "Venus",
    src: `${DOMAIN_ICONS}/grace.svg`,
    description: "The Voice — the psionic domain of empathy and soul.",
    color: "#b0567a"
  },
  terra: {
    id: "terra",
    label: "Terra",
    src: `${DOMAIN_ICONS}/sage.svg`,
    description: "The Seed — the psionic domain of restoration and evolution.",
    color: "#4f7a3a"
  },
  // --- Sphere of Fist ---
  neptune: {
    id: "neptune",
    label: "Neptune",
    src: `${DOMAIN_ICONS}/arcana.svg`,
    description: "The Dream — the psionic domain of paracausality and possibility.",
    color: "#25407a"
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter",
    src: `${DOMAIN_ICONS}/valor.svg`,
    description: "The Shield — the skill domain of durability and resolve.",
    color: "#c08a3e",
    invertText: true
  },
  mars: {
    id: "mars",
    label: "Mars",
    src: `${DOMAIN_ICONS}/blade.svg`,
    description: "The Sword — the skill domain of weapons and conflict.",
    color: "#a3341f"
  },
  // --- Outside the spheres ---
  nibiru: {
    id: "nibiru",
    label: "Nibiru",
    src: `${DOMAIN_ICONS}/dread.svg`,
    description: "The Chaos — the psionic domain of anomalies and horror.",
    color: "#3d1f4f"
  }
};
