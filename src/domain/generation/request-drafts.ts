/**
 * What the New Project and Generate forms hold and submit, as vocabulary.
 *
 * The rules that change a draft and build a request from it
 * (`reduceNewProjectDraft`, `buildGenerateScoreRequest`, `styleRoster`) are
 * music_lib's; the job that runs the request is music_client's. The shapes and
 * option lists are here because both apps draw these forms and music_client
 * submits what they produce without depending on music_lib.
 */
import type { KeySignature, Score, TimeSignature } from "../../model/score";
import type { GenerateScoreRequest } from "../../model/generation";

/**
 * The shape `POST /jobs` wants for a `generate-track` job.
 *
 * Structurally a `GenerateScoreRequest` with exactly one track — the server
 * treats it the same way and appends the result rather than replacing the
 * score.
 */
export type GenerateTrackRequest = GenerateScoreRequest;

export type GenerateScoreComplexity = NonNullable<
  GenerateScoreRequest["complexity"]
>;

export const GENERATE_SCORE_MOOD_OPTIONS: readonly string[] = [
  "gentle",
  "dark",
  "upbeat",
  "dramatic",
  "calm",
  "energetic",
];

export const GENERATE_SCORE_COMPLEXITY_OPTIONS = [
  "simple",
  "moderate",
  "complex",
] as const satisfies readonly GenerateScoreComplexity[];

/** The language a lyric is written in. Undefined on the request is English. */
export type LyricsLanguage = "en" | "zh";

export const LYRICS_LANGUAGE_OPTIONS = [
  "en",
  "zh",
] as const satisfies readonly LyricsLanguage[];

export type GenerateScoreKeyFifthsOption = { fifths: number; label: string };

/** Fifths -7..7, labeled by major-key tonic. The separate mode field supplies major/minor. */
export const GENERATE_SCORE_KEY_FIFTHS_OPTIONS: readonly GenerateScoreKeyFifthsOption[] =
  [
    { fifths: -7, label: "Cb" },
    { fifths: -6, label: "Gb" },
    { fifths: -5, label: "Db" },
    { fifths: -4, label: "Ab" },
    { fifths: -3, label: "Eb" },
    { fifths: -2, label: "Bb" },
    { fifths: -1, label: "F" },
    { fifths: 0, label: "C" },
    { fifths: 1, label: "G" },
    { fifths: 2, label: "D" },
    { fifths: 3, label: "A" },
    { fifths: 4, label: "E" },
    { fifths: 5, label: "B" },
    { fifths: 6, label: "F#" },
    { fifths: 7, label: "C#" },
  ];

export const GENERATE_SCORE_TIME_SIGNATURE_OPTIONS: Record<
  string,
  TimeSignature
> = {
  "4/4": { numerator: 4, denominator: 4 },
  "3/4": { numerator: 3, denominator: 4 },
  "2/4": { numerator: 2, denominator: 4 },
  "6/8": { numerator: 6, denominator: 8 },
  "5/4": { numerator: 5, denominator: 4 },
  "7/8": { numerator: 7, denominator: 8 },
};

/** Which of a style's tiers an ensemble entry came from. */
export type StyleTier = "essential" | "preferred" | "optional";

export type StyleRosterEntry = { value: string; tier: StyleTier };

export type InstrumentValueEntry = { id: number; value: string };

export type GenerateScoreRequestDraft = {
  title?: string;
  prompt: string;
  durationMeasures: number;
  instrumentValues: readonly string[];
  complexity?: GenerateScoreComplexity;
  timeSignature?: TimeSignature;
  keySignature?: KeySignature;
  style?: string;
  mood?: string;
  tempoText?: string;
  /**
   * Whether the sung part comes back with words under it.
   *
   * Only ever reaches the wire when somebody in the roster can sing them —
   * see `buildGenerateScoreRequest`. Deliberately not inferred from the roster
   * alone: a voice program held as a wordless "ooh" pad is a different piece of
   * music from a song with a lyric, and asking is the only way to tell.
   */
  lyrics?: boolean;
  /**
   * What the words are about, when that is not what the piece is about.
   *
   * Only reaches the wire alongside the lyrics it describes — see
   * `buildGenerateScoreRequest`. Blank is no theme: an input somebody tabbed
   * through must not become a subject line.
   */
  lyricsTheme?: string;
  /**
   * Which language the words are written in; English when absent.
   *
   * Only reaches the wire alongside the lyrics it describes — see
   * `buildGenerateScoreRequest`. An app sets it from the language the reader is
   * working in, so a Chinese session gets 中文 words rather than English ones.
   */
  lyricsLanguage?: "en" | "zh";
};

/**
 * The half of a New Project draft that does not involve the model.
 *
 * `GenerateScoreRequestDraft` is structurally assignable to this — it is this
 * plus `prompt`, `style`, `mood` and `complexity` — which is what lets one form
 * state feed both builders and the Generate-for-me toggle decide only which one
 * runs. Two draft types would be two shapes to keep in step for no gain.
 */
export type NewProjectDraft = {
  title?: string;
  durationMeasures: number;
  instrumentValues: readonly string[];
  timeSignature?: TimeSignature;
  keySignature?: KeySignature;
  tempoText?: string;
  /** Style token used for shared style-setting validation. */
  style?: string;
};

/**
 * What a New Project form asked for.
 *
 * A discriminated result rather than a request, because the same form backs a
 * server project on two dashboards and a *local document* from the macOS File
 * menu. The form decides what was asked for; the caller decides where it lands
 * (music_client's `createGeneratedProject` for a server project).
 */
export type NewProjectSubmission =
  | { kind: "generate"; request: GenerateScoreRequest }
  | { kind: "blank"; title: string; score: Score };

/**
 * One row of the instrumentation, and which of the style's tiers put it there.
 *
 * `id` survives reordering and repeats — two violins is a real ensemble, and
 * "remove the second violin" has to mean that one. A row added or changed by
 * hand carries no tier, so a second kit added on purpose is always the reader's
 * to remove.
 */
export type NewProjectEntry = InstrumentValueEntry & { tier?: StyleTier };

/**
 * Everything the New Project form holds.
 *
 * Text fields stay text: `measuresText`, `tempoText` and `durationText` are what
 * was typed, so "1:" part way through an edit is not rewritten under the cursor.
 * `style` and `mood` use `''` for "none"; a picker that cannot hold an empty
 * value maps it through `NO_MARK` (see `labelledOptions`).
 */
export type NewProjectFormDraft = {
  title: string;
  /**
   * Whether a model writes the music. Off by default: this is New Project, and
   * a blank score with the right instruments is the ordinary way to start one.
   * Flipping it never clears anything — losing a typed prompt to a toggle is
   * not worth the tidiness.
   */
  generating: boolean;
  prompt: string;
  style: string;
  mood: string;
  complexity: GenerateScoreComplexity;
  variant: string;
  /**
   * Words under the sung notes. On by default, because somebody who has just
   * been given a singer is writing a song; a switch rather than an inference,
   * because a voice held as a wordless pad is a different piece of music.
   */
  lyrics: boolean;
  /** What the words are about, when that is not what the piece is about. Blank is "the same". */
  lyricsTheme: string;
  /**
   * Which language the words are written in. Set from the language the reader is
   * working in, so a Chinese session writes 中文 lyrics; English when the app
   * leaves it alone.
   */
  lyricsLanguage?: "en" | "zh";
  /**
   * The instrumentation, in order. Ordered because the first track that is not
   * percussion carries the melody, which makes position a musical decision.
   */
  ensemble: readonly NewProjectEntry[];
  nextEntryId: number;
  /**
   * The singer this form added, by entry id — so turning generation back off
   * removes that one and not whichever voice happens to be first. `null` once
   * it is gone, replaced by hand, or never added.
   */
  autoVocalId: number | null;
  measuresText: string;
  tempoText: string;
  /** Which length field the user edited most recently. */
  lengthSource: "bars" | "duration";
  /** A key of `GENERATE_SCORE_TIME_SIGNATURE_OPTIONS`. */
  meter: string;
  keySignature: KeySignature;
  durationText: string;
};

export type NewProjectDraftAction =
  | { type: "setTitle"; title: string }
  | { type: "setGenerating"; generating: boolean }
  | { type: "setPrompt"; prompt: string }
  | { type: "applyStyle"; style: string }
  | { type: "setMood"; mood: string }
  | { type: "setComplexity"; complexity: GenerateScoreComplexity }
  | { type: "setVariant"; variant: string }
  | { type: "setLyrics"; lyrics: boolean }
  | { type: "setLyricsTheme"; lyricsTheme: string }
  | { type: "setLyricsLanguage"; lyricsLanguage: "en" | "zh" | undefined }
  | { type: "addInstrument"; value: string }
  | { type: "removeInstrument"; id: number }
  | { type: "replaceInstrument"; id: number; value: string }
  | { type: "setBars"; text: string }
  | { type: "setTempo"; text: string }
  | { type: "setMeter"; meter: string }
  | { type: "setDuration"; text: string }
  /** Rewrites a typed length ("45") as what the bars now play ("0:45"): the field's blur. */
  | { type: "tidyDuration" }
  | { type: "setKey"; fifths: number }
  | { type: "setMode"; mode: KeySignature["mode"] };

/** How a UI should present a failed generation: the store's paywall, or an ordinary error. */
export type GenerationErrorKind = "paywall" | "error";

/** The choices a reader can lock for Generate Again, in the order they are shown. */
export const LOCKABLE = [
  "groove",
  "cycle",
  "arcEntry",
  "arcIntensity",
  "moment",
  "carrier",
  "formShape",
  "hook",
  "lyric",
] as const;

export type LockableChoice = (typeof LOCKABLE)[number];
