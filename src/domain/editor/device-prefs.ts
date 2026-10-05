/**
 * How this person likes to work, on this device: the vocabulary.
 *
 * The prefs themselves — validating a stored object, loading, saving, the
 * store that holds them — are music_lib's. The closed lists and the shape are
 * here because both apps draw a settings screen from them.
 */
import type { PitchDisplay } from "../score/display-score";
import type { PickerOption } from "../notation/picker-options";
import type { TrackInfoMode } from "./view-settings";
import type { PaperSize } from "./print";

/**
 * The colour scheme a reader asked for.
 *
 * An array with the type read off it, not a bare union: a union has no runtime
 * form, so the settings picker in each app would have to write the list out
 * again — which is how one of them comes to offer a mode nothing applies.
 * `system` means "follow the OS", and is the default because a device that has
 * been told to go dark at sunset should take the app with it.
 */
export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** A scheme that can actually be drawn: never `system`. */
export type ResolvedThemeMode = Exclude<ThemeMode, "system">;

/**
 * The word for each theme mode.
 *
 * The web's theme menu capitalised the mode's own name, so a Chinese reader
 * chose between "Light", "Dark" and "System" in English; both apps then fixed
 * that with the same three keys and each kept its own copy of the table. A
 * `Record`, so a fourth mode fails to compile rather than printing a key.
 *
 * Here rather than beside the other picker tables in `picker-options.ts`, for
 * the reason those live beside their own vocabularies: a list keyed by a closed
 * vocabulary belongs next to the vocabulary. (`picker-options` is also
 * evaluated before this module by the barrel, so a table there reading
 * `THEME_MODES` would read it before it exists.)
 */
export const THEME_MODE_LABEL_KEY: Record<ThemeMode, string> = {
  light: "settings.themeLight",
  dark: "settings.themeDark",
  system: "settings.themeSystem",
};

/** The three modes as a settings picker wants them: value plus its key. */
export const THEME_MODE_OPTIONS: ReadonlyArray<PickerOption<ThemeMode>> =
  THEME_MODES.map((value) => ({
    value,
    labelKey: THEME_MODE_LABEL_KEY[value],
  }));

export const FONT_SIZES = ["small", "medium", "large"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/**
 * The developer switches, shown while developer mode is on.
 *
 * Only one, and that is the point: this carried six overlay toggles from spec
 * §33 as well (`showIds`, `showTicks`, `showMeasureBoundaries`,
 * `showPlaybackScheduling`, `enableDiagnostics`, `enableValidationWarnings`),
 * and no package in the family ever read one of them. Both apps drew a switch
 * for each, so a developer could turn six settings on and watch nothing happen
 * — which is worse than the absent feature, because it reads as a broken one.
 * They are gone rather than left standing as a promise. A field added back here
 * has to have a reader.
 */
export type DevSettings = {
  /**
   * Which generation backend new scores are asked from.
   *
   * A developer setting rather than a Generate-dialog control on purpose: the
   * answer is the same for every generation until somebody is deliberately
   * comparing two of them, and putting it in the ordinary flow would ask every
   * user a question they have no basis to answer.
   *
   * Typed as a plain string rather than `GenerationVariant` so a value stored
   * by a newer build cannot break an older one — the server resolves it through
   * an allow-list and falls back to the default, so an unrecognised value is
   * harmless at both ends.
   */
  generationVariant: string;
};

export type DevicePrefs = {
  themeMode: ThemeMode;
  developerMode: boolean;
  pitchDisplay: PitchDisplay;
  /** The piano keyboard panel. Expanded by default on both apps. */
  keyboardCollapsed: boolean;
  /** How much of the track-info column the score shows. `full` by default. */
  trackInfo: TrackInfoMode;
  fontSize: FontSize;
  /**
   * The UI language as a BCP 47 tag, or `null` to follow the device.
   *
   * `null` rather than the device's language filled in, because "follow the
   * device" has to survive the device changing language.
   */
  language: string | null;
  /** Last generation provider selected on this device. */
  generationVariant: string;
  /**
   * The paper the reader last printed on, or `null` to follow the device's
   * region (`defaultPaperSizeFor`).
   *
   * Remembered because a reader's printer does not change between printouts;
   * `null` until they choose, for the same reason `language` is — "follow the
   * device" has to survive the device moving.
   */
  paperSize: PaperSize | null;
};

/**
 * The language to open in when nothing else has said.
 *
 * The reader's own choice first (the `language` pref, `null` for "follow the
 * device", which is what the pref stores rather than a filled-in answer so a
 * device that changes language is followed), then the device's own tags, then
 * the first language the build ships — which is English in both apps, and is
 * taken from the list rather than written in so a build that shipped another
 * one first would not be told it was English.
 *
 * **Tags are matched by their language subtag.** A phone stores a BCP 47 tag
 * and a browser reports `zh-CN`; neither `zh-Hans` nor `zh-CN` is a bundle
 * either app has, and comparing whole tags is how the native app came to ignore
 * its own reader's stored `zh-Hans` and open in English. A choice with no
 * bundle is skipped rather than honoured, since honouring it renders every
 * string as its raw key.
 *
 * `supported` stays each app's, because the two ship their strings differently
 * — the web fetches a directory per language, the native app bundles a JSON —
 * so which languages exist is a fact about the build. Only the rule is shared.
 */
export function preferredLanguage<T extends string>(
  chosen: string | null | undefined,
  deviceTags: readonly string[],
  supported: readonly [T, ...T[]],
): T {
  for (const tag of [chosen, ...deviceTags]) {
    const code = tag?.split("-")[0]?.toLowerCase() ?? "";
    const match = supported.find((language) => language === code);
    if (match) return match;
  }
  return supported[0];
}
