import { z } from "zod";
import type { KeySignature } from "../../model/score";
import {
  DEFAULT_VOCAL_INSTRUMENT_VALUE,
  isVocalInstrumentValue,
} from "../instruments/instrument-options";
import { measuresForSeconds, SONG_SECONDS } from "../notation/music-vocabulary";

/**
 * The keyword values the generation prompt parser branches on.
 *
 * These are shared product data: the app offers them, and the backend needs to
 * know that every offered prompt phrase has genre mechanics.
 */
const GENERATE_SCORE_STYLE_KEYS = [
  "waltz",
  "jazz",
  "pop",
  "cinematic",
  "ambient",
  "battle",
  "rock",
  "punk",
  "heavyMetal",
  "blues",
  "country",
  "bluegrass",
  "funk",
  "soul",
  "ragtime",
  "swing",
  "bossaNova",
  "samba",
  "salsa",
  "tango",
  "reggae",
  "hipHop",
  "trap",
  "lofi",
  "house",
  "techno",
  "trance",
  "edm",
  "electroSwing",
  "disco",
  "classical",
  "baroque",
  "symphonySmall",
  "symphonyMedium",
  "symphonyLarge",
  "march",
  "bollywood",
] as const;

export type GenerateScoreStyle = (typeof GENERATE_SCORE_STYLE_KEYS)[number];

export const GENERATE_SCORE_STYLE_OPTIONS: readonly string[] =
  GENERATE_SCORE_STYLE_KEYS;

export type GenerateScoreStylePreset = {
  /** What the model is told the style is. */
  prompt: string;
  /**
   * The style's core instruments as picker values: `essential` then
   * `preferred`, without the singer. Derived; see the three tiers below.
   */
  instruments: readonly string[];
  /**
   * Always in the roster and not removable while generating: the kit in a
   * style whose rhythm is the kit, the bass where the groove is the bass, the
   * instrument that defines the sound (a reggae guitar chop, a tango bandoneon).
   */
  essential: readonly string[];
  /**
   * Added automatically and removable. The singer is one of these in a song
   * style, and is only added when the model writes the music.
   */
  preferred: readonly string[];
  /**
   * The style's colour instruments. A couple are picked at random each time
   * the style is chosen, so two pieces of one style are not the same band.
   */
  optional: readonly string[];
  /** Beats per minute, in the middle of the range the genre is played at. */
  tempo: number;
  /** Bars the piece runs for, derived from the preset's tempo and meter. */
  measures: number;
  /** How long this style's pieces run, in seconds. Defaults to a typical song. */
  seconds?: number;
  /** The genre's form in bars, where it has one. */
  formBars?: number;
  /**
   * The keys this genre is actually played in, as key-signature `fifths`.
   *
   * Read with `mode` below, so a minor-mode genre's list is minor tonics: 0 is
   * A minor there and C major elsewhere. One is chosen per generation rather
   * than fixed, for the reason `styleRoster` picks optional instruments —
   * two goes at one genre are otherwise the same piece twice.
   *
   * Why the list is short and per-genre rather than "any of the twelve": a key
   * is not neutral. Horn music lives in flat keys because that is where the
   * instruments are comfortable, guitar music in E and A because that is where
   * the open strings are, and a big band asked for E major is a big band
   * playing badly.
   */
  keys?: readonly number[];
  /** A key of the app's generate-score time signature options. */
  timeSignature: string;
  /** The mode the genre usually sits in; absent where it is not typical. */
  mode?: KeySignature["mode"];
  /**
   * Whether `mode` REFUSES the other one, rather than merely preferring it.
   *
   * These are two different facts and they were one field. `mode` is
   * documented above as what a genre "usually" sits in — a default, which
   * `styleKey` uses to pick the key the dialog opens on — and
   * `generateScoreStyleSettings` then published it as a constraint the API
   * rejects requests against. A preference became a prohibition on the way
   * out of this file, and the styles that are genuinely written both ways
   * lost the mode they are less often in.
   *
   * Absent means fixed, so the ten styles that want the restriction keep it by
   * saying nothing. A style written in both modes sets this to `false`: its
   * `mode` still supplies the default, and a reader who asks for the other one
   * is no longer refused.
   */
  modeFixed?: boolean;
};

const KIT = "kit:0";
/** The singer, as a picker value. Only ever preferred or optional, never essential. */
const VOICE = DEFAULT_VOCAL_INSTRUMENT_VALUE;

const STYLE_PRESET_SOURCE: Readonly<
  Record<
    GenerateScoreStyle,
    Omit<GenerateScoreStylePreset, "measures" | "instruments">
  >
> = {
  waltz: {
    prompt:
      'waltz — a lilting three-four with the weight on beat one and a light "oom-pah-pah" accompaniment',
    essential: ["0"],
    preferred: ["48", "43"],
    optional: ["40", "73", "21", "46"],
    tempo: 160,
    keys: [0, 1, -1, 2],
    timeSignature: "3/4",
  },
  jazz: {
    prompt:
      "jazz — swung eighth notes, walking bass, extended chords, and a melody that phrases across the barline rather than sitting on the beat",
    essential: ["32", KIT],
    preferred: ["66", "0"],
    optional: ["56", "11", "26", VOICE],
    tempo: 132,
    keys: [-2, -3, -1, 0, 1],
    timeSignature: "4/4",
  },
  pop: {
    prompt:
      "pop — a clear singable hook, four-bar phrases, a backbeat on two and four, and space between the phrases",
    essential: [KIT, "33"],
    preferred: [VOICE, "0", "27"],
    optional: ["89", "48", "25", "61"],
    tempo: 120,
    keys: [0, 1, 2, -1, 3],
    timeSignature: "4/4",
  },
  cinematic: {
    prompt:
      "cinematic orchestral — long sustained lines that build, a rising dynamic arc, and rhythm that serves the swell rather than a groove",
    essential: ["48", "47"],
    preferred: ["60", "42", "40"],
    optional: ["46", "52", "0", "73"],
    tempo: 90,
    keys: [-1, 0, 1, -2],
    timeSignature: "4/4",
    mode: "minor",
    /*
      Minor suits dread and most trailer work, so it stays the default. It is
      not the whole idiom: the lydian sharp-4 over a major tonic is the sound
      of wonder in this repertoire, and a score that can never be written in
      major cannot do awe, discovery or a love theme.
    */
    modeFixed: false,
  },
  ambient: {
    prompt:
      "ambient — slow evolving pads, very long note values, no strong pulse, and silence used as a voice",
    essential: ["89"],
    preferred: ["0", "48"],
    optional: ["46", "11", "52", "73"],
    tempo: 70,
    keys: [0, -1, 1, 2],
    timeSignature: "4/4",
  },
  battle: {
    prompt:
      "driving battle music — insistent ostinato, hard accents, brass stabs against a relentless low pulse",
    essential: ["61", "48", "47"],
    preferred: [KIT],
    optional: ["52", "60", "57"],
    tempo: 150,
    keys: [-1, 0, 1, -2],
    timeSignature: "4/4",
    mode: "minor",
  },
  rock: {
    prompt:
      "rock — a hard backbeat on two and four, power-chord riffing, and a bass locked to the kick",
    essential: [KIT, "33", "29"],
    preferred: [VOICE, "27"],
    optional: ["18", "0", "30"],
    tempo: 128,
    keys: [4, 3, 1, 2, 0],
    timeSignature: "4/4",
  },
  punk: {
    prompt:
      "punk — fast straight eighths on downstrokes, three chords, no ornament, and a snare driving every backbeat. The guitar figure repeats unchanged through a section; the energy comes from the tempo and the drive, never from varying the part.",
    essential: [KIT, "34", "30"],
    preferred: [VOICE, "29"],
    optional: ["18"],
    tempo: 180,
    keys: [4, 3, 1, 2],
    timeSignature: "4/4",
  },
  heavyMetal: {
    prompt:
      "heavy metal — built on ONE palm-muted galloping low riff, repeated bar after bar through a section rather than rewritten each bar; minor and modal, double-kick drive underneath, and long held high notes over the top. The riff is the song: keep it the same and let the drums and the held lead supply the variation. ONE riff means one FIGURE, not one note - the riff moves between several pitches (root, flat-7, flat-6 and back is the classic shape), and a bar of the same pitch struck eight times is a pedal, not a riff.",
    essential: [KIT, "34", "30"],
    preferred: [VOICE, "29"],
    optional: ["48", "18", "52"],
    tempo: 152,
    keys: [1, -1, 0, 2],
    timeSignature: "4/4",
    mode: "minor",
    /* Minor and modal is the default and the bulk of the genre, but power and melodic metal are written in major; the mode is a preference, not the definition. */
    modeFixed: false,
  },
  blues: {
    formBars: 12,
    prompt:
      "twelve-bar blues — shuffle feel, blue notes and bends, call-and-response between a voice-like melody and answering fills, dominant seventh chords",
    essential: [KIT, "33", "27"],
    preferred: [VOICE, "22"],
    optional: ["0", "16", "66"],
    tempo: 88,
    keys: [4, 3, 1, -2, 0],
    timeSignature: "4/4",
  },
  country: {
    prompt:
      'country — a two-beat "boom-chick" bass and guitar, bright major harmony, fiddle and steel fills answering the melody',
    essential: [KIT, "32", "25"],
    preferred: [VOICE, "110"],
    optional: ["27", "105", "22", "0"],
    tempo: 118,
    keys: [1, 2, 3, 0, -1],
    timeSignature: "4/4",
  },
  bluegrass: {
    prompt:
      "bluegrass — fast acoustic picking, banjo rolls in constant eighths under a syncopated fiddle melody, driving upright bass on one and three",
    essential: ["105", "25", "32"],
    preferred: [VOICE, "110"],
    optional: ["22", "15"],
    tempo: 160,
    keys: [1, 2, 3, 0],
    timeSignature: "4/4",
  },
  funk: {
    prompt:
      "funk — heavily syncopated sixteenth-note groove, everything locked to a hard downbeat on the one, staccato stabs and plenty of rests",
    essential: [KIT, "36", "28"],
    preferred: [VOICE, "61", "4"],
    optional: ["16", "65", "81"],
    tempo: 104,
    keys: [-1, -2, 0, 1],
    timeSignature: "4/4",
  },
  soul: {
    prompt:
      "soul — a laid-back backbeat sitting slightly behind the beat, gospel-tinged chords, horn stabs answering a vocal-style melody",
    essential: [KIT, "33", "16"],
    preferred: [VOICE, "4", "61"],
    optional: ["48", "66", "27"],
    tempo: 96,
    keys: [-1, -2, -3, 0, 1],
    timeSignature: "4/4",
  },
  ragtime: {
    formBars: 16,
    prompt:
      "ragtime — a syncopated right-hand melody against a steady striding left-hand bass in two, cheerful and precise",
    essential: ["0"],
    preferred: [],
    optional: ["105", "71", "56"],
    tempo: 96,
    keys: [-1, -2, 0, 1],
    timeSignature: "2/4",
  },
  swing: {
    prompt:
      "big-band swing — swung eighth notes, brass and reed sections trading riffs, walking bass, ride-cymbal pulse with accents on two and four",
    essential: [KIT, "32"],
    preferred: [VOICE, "56", "66", "57", "0"],
    optional: ["71", "26", "11"],
    tempo: 168,
    keys: [-2, -3, -1, 0],
    timeSignature: "4/4",
  },
  bossaNova: {
    prompt:
      "bossa nova — a gentle syncopated guitar pattern, soft brushed drums, a lyrical melody sitting behind the beat, rich seventh and ninth chords",
    essential: ["24", "32"],
    preferred: [VOICE, KIT, "0"],
    optional: ["73", "66", "48"],
    tempo: 132,
    keys: [-1, -2, 0, 1],
    timeSignature: "4/4",
  },
  samba: {
    prompt:
      "samba — fast two-beat percussion-driven groove, heavy syncopation on the offbeats, surdo pulse landing on beat two",
    essential: [KIT, "32", "24"],
    preferred: [VOICE, "61"],
    optional: ["73", "0", "21"],
    tempo: 100,
    keys: [0, 1, -1, -2],
    timeSignature: "2/4",
  },
  salsa: {
    prompt:
      "salsa — clave-driven and minor-mode, a montuno piano ostinato, syncopated brass hits, busy percussion, bass playing the tumbao rather than the downbeat",
    essential: [KIT, "32", "0"],
    preferred: [VOICE, "56", "57"],
    optional: ["73", "66", "11"],
    tempo: 190,
    /*
      Minor, and the keys below are minor tonics: -1 is D minor here.

      Salsa was a major-mode preset, which put it in the same tonality as the
      big-band styles it already shares most of a horn section with — a salsa
      and a swing generated side by side came back in C major with six of
      their seven instruments the same, and sounded like each other whatever
      their rhythms did. Son montuno lives in minor; this is the same
      correction electro swing already carries, for the same reason.
    */
    keys: [-1, -3, 0, -2],
    timeSignature: "4/4",
    mode: "minor",
    /*
      Minor by default, but not exclusively: son and mambo are constantly in
      major, and "Oye Como Va" is a minor vamp while "El Manisero" is not. The
      collision above was between salsa's DEFAULT and swing's, and the default
      still fixes it — a reader who deliberately asks for a major salsa is
      asking for something the repertoire is full of.
    */
    modeFixed: false,
  },
  tango: {
    prompt:
      "tango — sharp dotted rhythms and dramatic accents, minor key, sudden stops and rubato pulls against a strict pulse",
    essential: ["23", "43"],
    preferred: ["40", "0", VOICE],
    optional: ["42", "24"],
    tempo: 120,
    keys: [0, -1, 1, -2],
    timeSignature: "4/4",
    mode: "minor",
    /* Minor dominates, though major tangos are common — "Por una Cabeza" is in major — and Piazzolla widened the language further. */
    modeFixed: false,
  },
  reggae: {
    prompt:
      "reggae — one-drop: the kick lands on beat three, not one; guitar and organ chop the offbeat eighths; bass plays a heavy melodic line, low and sparse",
    essential: [KIT, "33", "28"],
    preferred: [VOICE, "18"],
    optional: ["0", "61", "22", "57"],
    tempo: 78,
    keys: [0, 1, -1, 2],
    timeSignature: "4/4",
  },
  hipHop: {
    prompt:
      "hip-hop — a hard boom-bap drum pattern with swung sixteenths, a deep sustained sub bass, sparse looping keys, and space left for a vocal",
    essential: [KIT, "39"],
    preferred: [VOICE, "4"],
    optional: ["48", "11", "89"],
    tempo: 90,
    keys: [0, -1, -2, -3, 1],
    timeSignature: "4/4",
    mode: "minor",
    /* Major-key hip-hop is common wherever the sample is — much of the West Coast and jazz-rap canon sits in major. */
    modeFixed: false,
  },
  trap: {
    prompt:
      "trap — half-time: the snare lands on beat three alone, an 808 sub bass slides between long tuned notes, and hi-hats roll in fast subdivisions over large gaps",
    essential: [KIT, "38"],
    preferred: [VOICE, "89"],
    optional: ["11", "81", "10"],
    tempo: 140,
    keys: [-4, -3, -2, 0],
    timeSignature: "4/4",
    mode: "minor",
    /* The brighter plugg and melodic-trap end is written in major; minor merely dominates. */
    modeFixed: false,
  },
  lofi: {
    prompt:
      "lo-fi hip-hop — slow swung drums slightly off the grid, warm jazzy minor seventh chords, a sparse melody, unhurried and repetitive",
    essential: [KIT, "4"],
    preferred: ["33", "89"],
    optional: ["27", "11", VOICE],
    tempo: 74,
    keys: [-1, 0, -2, -3],
    timeSignature: "4/4",
    mode: "minor",
    /* Major-key lo-fi is where the genre's brighter, more nostalgic end lives; the jazz vocabulary is the same either way. */
    modeFixed: false,
  },
  house: {
    prompt:
      "house — four-on-the-floor kick, offbeat open hats, a repetitive synth riff, and a bassline locked to the eighths between the kicks",
    essential: [KIT, "38"],
    preferred: ["81", "89", VOICE],
    optional: ["0", "48", "62"],
    tempo: 126,
    keys: [0, -1, 1, -2],
    timeSignature: "4/4",
  },
  techno: {
    prompt:
      "techno — machine-like and loop-based: four-on-the-floor kick, sixteenth-note hats, one short synth-bass cell repeated, and timbre rather than chord changes carrying the track",
    essential: [KIT, "38"],
    preferred: ["81", "89"],
    optional: ["0", "48", "62"],
    tempo: 132,
    keys: [0, -1, -2, 1],
    timeSignature: "4/4",
    mode: "minor",
  },
  trance: {
    prompt:
      "trance — four-on-the-floor with an offbeat synth bass after every kick, supersaw arpeggios, and long builds and releases in sixteen-bar blocks",
    essential: [KIT, "38"],
    preferred: ["81", "89", VOICE],
    optional: ["0", "48", "62"],
    tempo: 138,
    keys: [0, -1, 1, -3],
    timeSignature: "4/4",
    mode: "minor",
    /* Uplifting trance resolves into major for its breakdowns and much of the canon is major throughout; minor is the default, not the genre. */
    modeFixed: false,
  },
  edm: {
    prompt:
      "edm — electronic dance built on a clear build, drop and breakdown in eight-bar blocks, four-on-the-floor underneath and a big repeated lead hook through the drop",
    essential: [KIT, "38"],
    preferred: ["81", "89", VOICE],
    optional: ["0", "48", "62"],
    tempo: 128,
    keys: [0, -1, -3, -4],
    timeSignature: "4/4",
    mode: "minor",
    /* Future bass is characteristically major, and major-key drops are common across the umbrella; minor is only the commonest choice. */
    modeFixed: false,
  },
  electroSwing: {
    prompt:
      "electro swing — vintage swing horns over a modern four-on-the-floor electronic beat, minor and bluesy in a gypsy-jazz vein; hard-swung eighths, syncopated and playful, with clarinet and trumpet riffs answering each other",
    essential: [KIT, "38"],
    /*
      The piano is preferred, not optional: gypsy jazz is carried by la pompe,
      the damped chord on every beat, and a lineup of kit, bass, voice and two
      horns had nobody to play it — measured on a real generation, nothing
      chopped the beat under the horns and the piece read as a ballad with a
      house kick. The tenor sax joins the optional row as the third horn the
      genre actually uses.
    */
    preferred: [VOICE, "56", "71", "0"],
    optional: ["57", "28", "66"],
    tempo: 122,
    keys: [-1, 0, -2, 1],
    timeSignature: "4/4",
    mode: "minor",
  },
  disco: {
    prompt:
      "disco — four-on-the-floor kick, offbeat hi-hats, an octave-jumping bassline, and string and guitar figures on the sixteenths",
    essential: [KIT, "33"],
    preferred: [VOICE, "48", "28"],
    optional: ["61", "4", "89"],
    tempo: 120,
    keys: [0, -1, 1, -2],
    timeSignature: "4/4",
  },
  classical: {
    prompt:
      "classical — balanced four-bar phrases answering each other, an Alberti or broken-chord accompaniment under a clear diatonic melody, and a cadence every four or eight bars",
    essential: ["40", "42"],
    preferred: ["0"],
    optional: ["41", "73", "68", "71", "60"],
    tempo: 108,
    keys: [0, 1, -1, 2, -2],
    timeSignature: "4/4",
  },
  baroque: {
    prompt:
      "baroque — a steady walking bass, contrapuntal interweaving voices, sequences and ornamented melodic lines, terraced dynamics",
    essential: ["6"],
    preferred: ["40", "42"],
    optional: ["68", "73", "56", "70"],
    tempo: 100,
    keys: [1, -1, 0, 2, -2],
    timeSignature: "4/4",
  },
  symphonySmall: {
    // "chamber symphony", not "classical" anything: the phrase must not
    // contain a word music_api's `classical` genre entry matches
    // (classical|mozart|haydn|sonata), or a small symphony request would
    // silently resolve to that entry's rules instead of its own.
    prompt:
      "chamber symphony — a small string-led ensemble stating balanced phrases, a light Alberti or block-chord accompaniment under a clear melodic line, and a cadence every four or eight bars",
    essential: ["40", "42"],
    preferred: ["41", "68"],
    optional: ["70", "60"],
    tempo: 104,
    keys: [0, 1, -1, 2, -2],
    timeSignature: "4/4",
    // Shorter than the typical song, on purpose: the smallest of the three
    // sizes, in both forces and duration. Not 150 itself: `measuresForSeconds`
    // rounds to the nearest whole four-bar group, and at this tempo 150s
    // rounds DOWN to 64 bars (147.7s actual) — under the "a listener would
    // call it a song" floor `request.test.ts` checks. 156 rounds to 68 bars,
    // 156.9s actual, clearing it with margin on either side of the rounding.
    seconds: 156,
  },
  symphonyMedium: {
    // "eighteenth-century", not "classical": see symphonySmall's comment
    // above — the same collision, with the same fix.
    prompt:
      "full orchestra symphony — an eighteenth-century orchestra stating a balanced theme and developing it through sequence and variation, with functional harmony and a cadence every four or eight bars",
    essential: ["40", "42", "60", "47"],
    preferred: ["41", "68", "71", "70", "56"],
    optional: ["73", "43"],
    tempo: 108,
    keys: [0, 1, -1, 2, -2],
    timeSignature: "4/4",
    seconds: 240,
  },
  symphonyLarge: {
    prompt:
      "romantic symphony — a full Romantic-era orchestra with expanded brass and strings, chromatic harmony, wide dynamic swells and a grand dramatic arc toward a full-orchestra climax",
    essential: ["40", "42", "43", "60", "47"],
    preferred: ["41", "68", "71", "70", "56", "57"],
    optional: ["73", "58", "46"],
    tempo: 96,
    // Minor tonics, per the field's own doc comment. Romantic drama leans
    // minor more often than not, but plenty of the repertoire — Brahms's
    // Second, Dvořák's Eighth — is major throughout.
    keys: [-1, 0, 1, -2, -3],
    timeSignature: "4/4",
    mode: "minor",
    modeFixed: false,
    // Longer than any other style's default: the largest of the three sizes,
    // in both forces and duration.
    seconds: 330,
  },
  march: {
    prompt:
      "march — a firm two-beat pulse, dotted fanfare rhythms, a brass melody over a low oom-pah, crisp snare figures",
    essential: [KIT, "58"],
    preferred: ["56", "57"],
    optional: ["71", "73", "60", "9"],
    tempo: 116,
    keys: [-2, -3, -1, 0],
    timeSignature: "2/4",
  },
  bollywood: {
    prompt:
      "Bollywood filmi — a bright Hindi film song over a tabla-and-dholak keherwa groove, a soaring ornamented lead vocal answered by lush strings and a bansuri flute, with harmonium, plucked sitar and santoor colour, frequent grace notes and melismatic turns, and a lift into a big full-band hook",
    essential: [KIT, "48"],
    preferred: [VOICE, "20"],
    optional: ["104", "73", "15", "89"],
    tempo: 108,
    // Minor tonics, per the field's doc comment: 0 is A minor here. Filmi
    // leans to a harmonic-minor / Bhairavi colour, but the up-tempo dance and
    // romance numbers are as often major, so the mode is a default, not a wall.
    keys: [0, -1, -2, 1],
    timeSignature: "4/4",
    mode: "minor",
    modeFixed: false,
  },
};

/**
 * How far either side of a style's nominal tempo a generation may land, as a
 * fraction of it.
 *
 * A rule rather than a number per genre, because `tempo` already documents
 * itself as "in the middle of the range the genre is played at" — the spread is
 * the other half of that sentence, and 33 hand-written pairs would be 33
 * chances to disagree with the one number beside them.
 *
 * Six percent is a bar or two of drift at either end: salsa 179-201, punk
 * 169-191, ambient 66-74. Wide enough that two generations of one genre are
 * not the same piece at the same speed, narrow enough that every one of them
 * is still that genre — a 40% swing would make a "slow blues" out of a shuffle
 * and nobody asked it to.
 */
export const TEMPO_SPREAD = 0.06;

/** The bpm range a style may be generated at, rounded to whole beats. */
export function styleTempoRange(
  style: string,
): readonly [number, number] | null {
  const preset = GENERATE_SCORE_STYLE_PRESETS[style];
  if (!preset) return null;
  const spread = Math.round(preset.tempo * TEMPO_SPREAD);
  return [preset.tempo - spread, preset.tempo + spread];
}

/**
 * The small, public subset of a style preset that a generation form needs.
 *
 * The full preset remains local product data because it includes prompt text
 * and instrument values. These settings are safe to serve from the backend so
 * clients can constrain their controls without copying the style table.
 */
export type GenerateScoreStyleSetting = {
  tempo: number;
  minBpm: number;
  maxBpm: number;
  /** The only meter offered by this style. */
  timeSignature: string;
  /** Key-signature fifths the style offers. */
  keys: readonly number[];
  /**
   * A mode the style refuses to leave, for the styles that have one.
   *
   * Absent means the caller may choose either — including for a style whose
   * preset states a usual mode, which is a default for the form rather than
   * a limit on the request.
   */
  mode?: KeySignature["mode"];
};

export type GenerateScoreStyleSettings = Readonly<
  Record<string, GenerateScoreStyleSetting>
>;

export const generateScoreStyleSettingSchema = z.object({
  tempo: z.number().int().positive(),
  minBpm: z.number().int().positive(),
  maxBpm: z.number().int().positive(),
  timeSignature: z.string().min(1),
  keys: z.array(z.number().int()).readonly(),
  mode: z.enum(["major", "minor"]).optional(),
});

export const generateScoreStyleSettingsResponseSchema = z.object({
  styles: z.record(z.string(), generateScoreStyleSettingSchema),
});

export type GenerateScoreStyleSettingsResponse = z.infer<
  typeof generateScoreStyleSettingsResponseSchema
>;

/** Builds the backend-owned settings payload without exposing prompt text. */
export function generateScoreStyleSettings(): GenerateScoreStyleSettings {
  const settings: Record<string, GenerateScoreStyleSetting> = {};
  for (const [style, preset] of Object.entries(GENERATE_SCORE_STYLE_PRESETS)) {
    const range = styleTempoRange(style);
    if (!range) continue;
    const [minBpm, maxBpm] = range;
    settings[style] = {
      tempo: preset.tempo,
      minBpm,
      maxBpm,
      timeSignature: preset.timeSignature,
      keys: [...(preset.keys ?? [])],
      // Only a mode the style REFUSES to leave. A default belongs to
      // `styleKey`, which reads the preset directly.
      ...(preset.mode && preset.modeFixed !== false
        ? { mode: preset.mode }
        : {}),
    };
  }
  return settings;
}

/** Resolves either a style token or the expanded style phrase on the wire. */
export function generateScoreStyleSettingFor(
  style: string | undefined,
): GenerateScoreStyleSetting | null {
  if (!style) return null;
  const token = Object.prototype.hasOwnProperty.call(
    GENERATE_SCORE_STYLE_PRESETS,
    style,
  )
    ? style
    : Object.entries(GENERATE_SCORE_STYLE_PRESETS).find(
        ([, preset]) => preset.prompt === style,
      )?.[0];
  return token ? (generateScoreStyleSettings()[token] ?? null) : null;
}

/**
 * The styles, each with the bars its own tempo and meter need for a song.
 */
export const GENERATE_SCORE_STYLE_PRESETS: Readonly<
  Record<string, GenerateScoreStylePreset>
> = Object.fromEntries(
  Object.entries(STYLE_PRESET_SOURCE).map(([style, preset]) => [
    style,
    {
      ...preset,
      instruments: [...preset.essential, ...preset.preferred].filter(
        (value) => !isVocalInstrumentValue(value),
      ),
      measures: measuresForSeconds(
        preset.seconds ?? SONG_SECONDS.typical,
        preset.tempo,
        beatsPerBarOf(preset.timeSignature),
        preset.formBars,
      ),
    },
  ]),
);

/** Beats in a bar, from a picker value like "6/8". */
function beatsPerBarOf(timeSignature: string): number {
  const [numerator] = timeSignature.split("/");
  const beats = Number(numerator);
  return Number.isFinite(beats) && beats > 0 ? beats : 4;
}
