import type { GenerateScoreStyle } from "./style-presets";

/**
 * The headings the style picker groups its entries under.
 *
 * Presentation only. A request still names one flat style (`bossaNova`), and
 * every table that implements a style — genre rules, song forms, lyric
 * patterns, the style pages — stays keyed by that style. A family inherits
 * nothing and passes nothing down: the rules that were generalised across
 * styles are the ones recorded as punishing correct music, so a family is
 * where a reader looks for a style, not what the style is made of.
 *
 * Not the same grouping as music_api's `FAMILY_OF_GENRE`, which groups styles
 * by the song FORM they share — reggae and waltz both take the 64-bar song
 * template, and nobody looks for them under one heading.
 *
 * Declared as an array with the type read off it, so a family can be listed
 * and validated at runtime; each one's words are the hosts', by key.
 */
export const STYLE_FAMILIES = [
  "popRock",
  "americanRoots",
  "jazz",
  "funkSoul",
  "latinCaribbean",
  "hipHop",
  "electronic",
  "classical",
  "danceCeremonial",
  "screen",
] as const;

export type StyleFamily = (typeof STYLE_FAMILIES)[number];

/**
 * Which heading each style sits under.
 *
 * A `Record` over the style vocabulary, so a style added without a family
 * fails to compile rather than silently dropping out of a grouped picker.
 */
export const STYLE_FAMILY_OF: Readonly<Record<GenerateScoreStyle, StyleFamily>> =
  {
    pop: "popRock",
    rock: "popRock",
    punk: "popRock",
    heavyMetal: "popRock",
    blues: "americanRoots",
    country: "americanRoots",
    bluegrass: "americanRoots",
    jazz: "jazz",
    swing: "jazz",
    ragtime: "jazz",
    electroSwing: "jazz",
    funk: "funkSoul",
    soul: "funkSoul",
    disco: "funkSoul",
    salsa: "latinCaribbean",
    samba: "latinCaribbean",
    bossaNova: "latinCaribbean",
    tango: "latinCaribbean",
    reggae: "latinCaribbean",
    hipHop: "hipHop",
    trap: "hipHop",
    lofi: "hipHop",
    house: "electronic",
    techno: "electronic",
    trance: "electronic",
    edm: "electronic",
    classical: "classical",
    baroque: "classical",
    symphonySmall: "classical",
    symphonyMedium: "classical",
    symphonyLarge: "classical",
    waltz: "danceCeremonial",
    march: "danceCeremonial",
    cinematic: "screen",
    battle: "screen",
    ambient: "screen",
    bollywood: "screen",
  };

/** The family a style token belongs to, or null for one this build does not know. */
export function styleFamilyOf(style: string): StyleFamily | null {
  return Object.prototype.hasOwnProperty.call(STYLE_FAMILY_OF, style)
    ? STYLE_FAMILY_OF[style as GenerateScoreStyle]
    : null;
}

/** The family's styles, in declaration order. */
export function stylesInFamily(family: StyleFamily): GenerateScoreStyle[] {
  return (Object.keys(STYLE_FAMILY_OF) as GenerateScoreStyle[]).filter(
    (style) => STYLE_FAMILY_OF[style] === family,
  );
}
