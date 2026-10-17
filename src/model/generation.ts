/**
 * The AI generation contracts, and the schemas that validate them.
 *
 * The request and result shapes `music_api` and the app agree on. Both sides
 * import these, which is the whole reason this package exists.
 */
import { z } from "zod";
import {
  clefSchema,
  keySignatureSchema,
  measureSchema,
  scoreSchema,
  timeSignatureSchema,
} from "./schemas";
import type {
  Lyric,
  Score,
  ScoreFragment,
  KeySignature,
  ScoreRange,
  TimeSignature,
  Track,
  UUID,
} from "./score";
// ---------------------------------------------------------------------------
// 5. AI generation contracts
// ---------------------------------------------------------------------------

/**
 * A part to write, as the request names it.
 *
 * There is deliberately no `range` here. An instrument's compass is a fact
 * about its GM program, which `gm-catalogue.ts` already states and
 * `trackKeyboardRange` already answers — so the server derives it and no client
 * has to agree with it. It used to be an optional field that no client in the
 * family ever filled, which meant the generation prompt stated no compass at
 * all: measured on one generated score, a timpani came back with 482 of its
 * 1,067 notes below its lowest drum.
 */
export type GenerateScoreRequestTrack = {
  name: string;
  instrumentName: string;
  midiProgram: number;
  clef: Track["clef"];
  maximumPolyphony?: number;
};

/**
 * The generation backends a client may choose between.
 *
 * A closed vocabulary declared as an array with the type read off it, because a
 * TypeScript union has no runtime form and the picker needs to enumerate these.
 * The *names* are shared; which model each one resolves to is the server's
 * business, and deliberately not stated here — that mapping changes with
 * configuration, and a copy of it in the client would be wrong the first time
 * it did.
 *
 * `default` is what every ordinary request uses. The others exist so the same
 * brief can be run through two backends and compared by ear, which became worth
 * doing once the provider was a configuration change rather than a code change.
 */
export const GENERATION_VARIANTS = ["default", "deepseek", "claude", "local"] as const;
export type GenerationVariant = (typeof GENERATION_VARIANTS)[number];

/**
 * What to call each one in a picker.
 *
 * A `Record` keyed by the vocabulary, never a parallel array: a record fails to
 * compile when a variant is added, where an array would silently go on offering
 * the old set.
 */
export const GENERATION_VARIANT_LABELS: Record<GenerationVariant, string> = {
  /*
    Named after the provider it reaches, not after its position in the list.

    "Default" told a reader only that it was the one already selected, which is
    a fact about the picker; what they are choosing between is which company's
    model writes the music.
  */
  default: "Open AI",
  deepseek: "DeepSeek",
  claude: "Claude",
  /*
    A model running on the machine, served by LM Studio through ShapeShyft.

    Reachable only from a ShapeShyft instance on that same machine: the hosted
    one cannot open a socket to somebody's laptop, so this variant works
    against a local `SHAPESHYFT_API_URL` and nowhere else.
  */
  local: "Local (LM Studio)",
};

/**
 * A request tagged with the generation backend to use, when it is not the default.
 *
 * Generic over the request rather than written twice, because whole-score
 * generation and region replacement carry the same field for the same reason
 * and a rule copied into two call sites is a rule that eventually disagrees
 * with itself.
 *
 * The default is expressed by sending **no field at all**, so an ordinary
 * request is byte-for-byte what it was before backends could be chosen. That
 * matters on the wire: a field present on every request is a field the server
 * has to reason about on every request.
 */
export function withGenerationVariant<T extends { variant?: string }>(
  request: T,
  variant: string | undefined,
): T {
  return variant && variant !== "default" ? { ...request, variant } : request;
}

/**
 * The creative choices a generation was built from.
 *
 * The server rolls each of these per piece — the shape of the form, the chord
 * cycle, the hook's gesture, the rhythm section's groove, who opens the piece
 * and how it builds, its signature moment, which instrument carries the tune,
 * and how the words are written — so that two generations of one request are
 * two different pieces. They are NAMES, as the server's own tables spell them,
 * and they are returned and stored so a piece can be understood, regenerated in
 * part without switching groove halfway through, or generated again with some
 * choices kept and the rest re-rolled.
 *
 * A null means the style had nothing to choose between for that dimension.
 */
export type GenerationChoices = {
  formShape: string;
  cycle: string | null;
  hook: string;
  groove: string | null;
  arcEntry: string;
  arcIntensity: string;
  moment: string | null;
  /** Index into the request's tracks, and that track's name for display. */
  carrier: number | null;
  carrierName: string | null;
  lyric: string | null;
};

/** A generation as it was asked for and as it came out: enough to run it again. */
export type GenerationRecord = {
  request: GenerateScoreRequest;
  choices: GenerationChoices;
};

export type GenerateScoreRequest = {
  prompt: string;
  title?: string;
  style?: string;
  mood?: string;
  durationMeasures: number;
  tempo?: number;
  timeSignature?: TimeSignature;
  keySignature?: KeySignature;
  tracks: GenerateScoreRequestTrack[];
  complexity?: "simple" | "moderate" | "complex";
  /**
   * Which generation backend to use, for comparing one against another.
   *
   * A *name*, not an address: the server maps it through its own allow-list to
   * a model and endpoint, so a client can pick from what is offered and cannot
   * point generation at anything else. An unknown or absent value means the
   * default backend, which is what every ordinary request sends.
   *
   * This exists because the provider is now a configuration change rather than
   * a code change, and the only honest way to choose between two of them is to
   * run the same brief through both and listen.
   */
  variant?: string;

  /**
   * Whether the sung part comes back with words under it.
   *
   * Off by default, and deliberately not inferred from the roster: a score can
   * carry a voice program as a wordless "ooh" pad, which is a different piece
   * of music from a song with a lyric. Asking is the only way to tell.
   *
   * A boolean rather than a subject line, because `prompt` already says what
   * the piece is about — a second field for the lyric's theme would be a place
   * for the two to disagree.
   */
  lyrics?: boolean;

  /**
   * What the words are about, when that is not simply what the piece is about.
   *
   * This field once did not exist on the grounds that `prompt` already says
   * what the piece is, and a second subject line is a place for the two to
   * disagree. What it missed is that they are genuinely different questions:
   * "a slow waltz in D minor" describes the music, and the words over it can be
   * about coming home without the music brief being about coming home.
   *
   * The disagreement is avoided by **replacing rather than adding**: the server
   * has exactly one "the words are about" clause, and this fills it when it is
   * present. Absent or blank, that clause falls back to `prompt` and the lyric
   * is what it always was. `prompt` still reaches the model in its own right, so
   * narrowing the words' subject never hides the piece's brief.
   *
   * Never sent without `lyrics`: `buildGenerateScoreRequest` drops it in the
   * same breath it drops `lyrics` for a roster with nobody to sing, so a theme
   * for a lyric that was not asked for cannot reach the wire.
   */
  lyricsTheme?: string;

  /**
   * Choices to KEEP, by name, from an earlier generation.
   *
   * Every dimension named here is used as given where it is still valid for
   * this request's style, key and form; every dimension left out is rolled as
   * usual. This is how "keep the groove, try different chords" works: send the
   * earlier generation's request with `choices: { groove }`.
   */
  choices?: Partial<GenerationChoices>;
};

/** Never a rendered/notation payload and never raw MIDI: always a structured `Score`. */
export type GenerateScoreResult = {
  score: Score;
  warnings: string[];
  /** The choices this score was built from, where the server made any. */
  choices?: GenerationChoices;
};

export type RegenerationConstraints = {
  /**
   * Absent for a region that does not sit on barlines (Replace Notes), where
   * "preserve the measure count" says nothing and only muddies the prompt.
   * Still never `false`: a regeneration that may add or drop measures is not
   * a thing this system asks for.
   */
  preserveMeasureCount?: true;
  preserveTimeSignatures: true;
  preserveTempoEvents: true;
  preserveBoundaryNotes?: boolean;
  preserveHarmony?: boolean;
  preserveRhythm?: boolean;
  preserveMelody?: boolean;
  maximumPolyphony?: number;
  allowedPitchRangeByTrack?: Record<
    string,
    { lowestMidi: number; highestMidi: number }
  >;
};

export type RegenerateRegionRequest = {
  scoreId: string;
  /**
   * The choices of the generation this region belongs to, filled in
   * by the server from the project it is regenerating.
   *
   * A regenerated region used to roll its own groove, so replacing eight bars
   * of a songo could put a tumbao in the middle of it. With these the region is
   * written in the groove, and to the lyric approach, the piece already has.
   * The groove is looked up within this request's own `style`.
   */
  choices?: Partial<GenerationChoices>;
  instruction: string;
  range: ScoreRange;
  precedingContext: ScoreFragment;
  selectedFragment: ScoreFragment;
  followingContext: ScoreFragment;
  constraints: RegenerationConstraints;
  candidateCount: number;
  /**
   * Which backend writes the replacement. See `GenerateScoreRequest.variant`.
   *
   * Regeneration used to have no say in this: the transport read the variant
   * off the whole-score request alone, so a "Replace Track" always went to the
   * default backend however the piece around it had been written. Choosing the
   * model for a whole score and not for a bar of it is an odd place to draw
   * the line, and it makes an A/B comparison impossible on the very operation
   * that is cheapest to compare.
   */
  variant?: string;
  /**
   * Who is playing each track of `selectedFragment`, in the same order.
   *
   * A fragment carries measures and nothing else — no name, no clef, no
   * program — so without this the model regenerates blind and has to guess the
   * instrument from the notes in front of it. On a drum track there is nothing
   * to guess from: the pitches are drum numbers, and a model that does not
   * know that writes a melody on a kit. (Measured on a real "Replace Track"
   * over a Power Kit: the kick landed on every eighth of all 118 bars at one
   * velocity, because the model was never told it was writing for a kit.)
   *
   * Optional because a client that predates it still gets a valid request;
   * the prompt simply omits what it was not given.
   */
  tracks?: GenerateScoreRequestTrack[];
  /**
   * The tracks that are NOT being regenerated, over the same span.
   *
   * "Write a part that works with the piano" cannot be obeyed by a model that
   * has never been shown the piano. `selectedFragment` holds only the tracks
   * being rewritten, and the preceding/following contexts are *earlier and
   * later bars*, not *other parts of the same bars* — so regenerating one
   * track of an arrangement showed the model an empty stave and asked it to
   * harmonise with nothing. It answered with something plausible in C major
   * that had no relationship to the music it was joining.
   *
   * `tracks` and `fragment` are matched by position, like the roster above.
   * The model must not write these; they are there to be listened to.
   */
  accompaniment?: {
    tracks: GenerateScoreRequestTrack[];
    fragment: ScoreFragment;
  };
  /** Same three dials whole-score generation has; the prompt builder emits them identically. */
  style?: string;
  mood?: string;
  complexity?: "simple" | "moderate" | "complex";
};

export type RegenerationCandidate = {
  id: string;
  label: string;
  fragment: ScoreFragment;
};

export type RegenerateRegionResult = {
  candidates: RegenerationCandidate[];
  warnings: string[];
};

export interface MusicGenerationProvider {
  id: string;
  name: string;
  generateScore(
    request: GenerateScoreRequest,
    signal?: AbortSignal,
  ): Promise<GenerateScoreResult>;
  regenerateRegion(
    request: RegenerateRegionRequest,
    signal?: AbortSignal,
  ): Promise<RegenerateRegionResult>;
}

// ---------------------------------------------------------------------------
// 6. Zod schemas for the generation contracts
// ---------------------------------------------------------------------------

export const midiRangeSchema = z.object({
  lowestMidi: z.number().int().min(0).max(127),
  highestMidi: z.number().int().min(0).max(127),
});

export const scoreRangeSchema = z.object({
  startTick: z.number().int().nonnegative(),
  endTick: z.number().int().nonnegative(),
  trackIds: z.array(z.string().min(1)),
});

export const scoreFragmentSchema = z.object({
  range: scoreRangeSchema,
  ppq: z.number().int().positive(),
  tracks: z.array(
    z.object({ trackId: z.string().min(1), measures: z.array(measureSchema) }),
  ),
});

export const generateScoreRequestTrackSchema = z.object({
  name: z.string(),
  instrumentName: z.string(),
  midiProgram: z.number().int().min(0).max(127),
  clef: clefSchema,
  maximumPolyphony: z.number().int().positive().optional(),
});

export const generateScoreRequestSchema = z.object({
  prompt: z.string(),
  title: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  durationMeasures: z.number().int().positive(),
  tempo: z.number().positive().optional(),
  timeSignature: timeSignatureSchema.optional(),
  keySignature: keySignatureSchema.optional(),
  tracks: z.array(generateScoreRequestTrackSchema),
  complexity: z.enum(["simple", "moderate", "complex"]).optional(),
  // A free string on the wire, resolved against the server's allow-list rather
  // than trusted: see `GenerateScoreRequest.variant`.
  variant: z.string().optional(),
  lyrics: z.boolean().optional(),
  lyricsTheme: z.string().optional(),
  choices: z.lazy(() => generationChoicesSchema.partial()).optional(),
});

export const generationChoicesSchema = z.object({
  formShape: z.string(),
  cycle: z.string().nullable(),
  hook: z.string(),
  groove: z.string().nullable(),
  arcEntry: z.string(),
  arcIntensity: z.string(),
  moment: z.string().nullable(),
  carrier: z.number().int().nonnegative().nullable(),
  carrierName: z.string().nullable(),
  lyric: z.string().nullable(),
});

export const generationRecordSchema = z.object({
  request: generateScoreRequestSchema,
  choices: generationChoicesSchema,
});

export const generateScoreResultSchema = z.object({
  score: scoreSchema,
  warnings: z.array(z.string()),
  choices: generationChoicesSchema.optional(),
});

export const regenerationConstraintsSchema = z.object({
  preserveMeasureCount: z.literal(true).optional(),
  preserveTimeSignatures: z.literal(true),
  preserveTempoEvents: z.literal(true),
  preserveBoundaryNotes: z.boolean().optional(),
  preserveHarmony: z.boolean().optional(),
  preserveRhythm: z.boolean().optional(),
  preserveMelody: z.boolean().optional(),
  maximumPolyphony: z.number().int().positive().optional(),
  allowedPitchRangeByTrack: z.record(z.string(), midiRangeSchema).optional(),
});

export const regenerateRegionRequestSchema = z.object({
  scoreId: z.string().min(1),
  instruction: z.string(),
  range: scoreRangeSchema,
  precedingContext: scoreFragmentSchema,
  selectedFragment: scoreFragmentSchema,
  followingContext: scoreFragmentSchema,
  constraints: regenerationConstraintsSchema,
  candidateCount: z.number().int().positive(),
  // A free string on the wire, resolved against the server's allow-list rather
  // than trusted: see `GenerateScoreRequest.variant`.
  variant: z.string().optional(),
  choices: z.lazy(() => generationChoicesSchema.partial()).optional(),
  tracks: z.array(generateScoreRequestTrackSchema).optional(),
  accompaniment: z
    .object({
      tracks: z.array(generateScoreRequestTrackSchema),
      fragment: scoreFragmentSchema,
    })
    .optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  complexity: z.enum(["simple", "moderate", "complex"]).optional(),
});

export const regenerationCandidateSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  fragment: scoreFragmentSchema,
});

export const regenerateRegionResultSchema = z.object({
  candidates: z.array(regenerationCandidateSchema),
  warnings: z.array(z.string()),
});

/** Whether a project can be edited right now. Two states, because that is the only question the editor asks. */
/**
 * What currently owns a project.
 *
 * `generating` and `transcribing` both mean "a job is producing this project's
 * music, and writes must be refused until it lands" — they are distinct so the
 * editor can say which is happening, since one takes seconds of model time and
 * the other minutes of audio.
 */
export type ProjectStatus = "ready" | "generating" | "transcribing";

export const projectStatusSchema = z.enum([
  "ready",
  "generating",
  "transcribing",
]);

/** Which of the five generation entry points produced a job. */
export type GenerationJobKind =
  | "generate-score"
  | "generate-track"
  | "replace-notes"
  | "replace-measures"
  | "replace-track";

export const generationJobKindSchema = z.enum([
  "generate-score",
  "generate-track",
  "replace-notes",
  "replace-measures",
  "replace-track",
]);

/**
 * Align a line of words onto a project's existing melody.
 *
 * Unlike the five generation kinds this is not a model job: the words are given,
 * and the server lays them on the tune deterministically (music_types'
 * `alignLyricsToTrack` over the shared syllable rules). It is a synchronous
 * route rather than a queued job, so it carries its own small request and reply
 * rather than going through `GenerationJobKind`.
 */
export type AlignLyricsRequest = {
  /** The words to align, written as a lyric sheet does — spaces and hyphens. */
  text: string;
  /** Which track to sing. Defaults to the project's vocal track, else the first. */
  trackId?: string;
  /** Language rules for an un-hyphenated word; detected from the text when absent. */
  language?: "en" | "zh";
};

export const alignLyricsRequestSchema = z.object({
  text: z.string().min(1),
  trackId: z.string().min(1).optional(),
  language: z.enum(["en", "zh"]).optional(),
});

export type AlignLyricsResponse = {
  /** The project's score with the track's lyrics rewritten. */
  score: Score;
  /** How many syllables were placed on a note. */
  applied: number;
  /** Words that did not fit — more syllables than the tune has notes. */
  leftover: Lyric[];
  /** The track the words were sung on, or null when the score has none to sing. */
  trackId: string | null;
};

/**
 * A job's own lifecycle, which is richer than its project's: `cancelled`
 * records that a result was produced and thrown away, which `ready` on the
 * project cannot express.
 */
/**
 * `queued` is a job waiting its turn: a user's generations run one at a time, so
 * a job accepted while another is running waits rather than being refused. Its
 * project is already `generating` — the request is built against the stored
 * score, so that score must not move underneath it while it waits.
 */
export type GenerationJobStatus =
  "queued" | "running" | "done" | "failed" | "cancelled";

export const generationJobStatusSchema = z.enum([
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
]);

/**
 * A job as reported to the client. The stored `request`/`result` payloads are
 * deliberately absent — they are large and the client never needs them.
 */
export type GenerationJob = {
  id: UUID;
  projectId: UUID;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  /** Absent when the job never reached the model, or the stream reported no usage. */
  usage?: TokenUsage;
};

/**
 * What one generation job cost the provider.
 *
 * Lives here rather than in music_api because the client sees it: `GET /jobs/:id`
 * carries it, and the app has no other way to report what a generation used.
 *
 * There is deliberately no `totalTokens` — it is the sum of the other two, and a
 * stored derivable value is a chance for them to disagree. `model` is present
 * because tokens only become money per-model and the model is env-configurable,
 * so a total without it cannot be priced afterwards.
 */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  model: string;
  /** ShapeShyft's provider pricing estimate, in US cents. */
  estimatedCostCents?: number;
};

export const tokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  model: z.string().min(1),
  estimatedCostCents: z.number().nonnegative().optional(),
});

export const generationJobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  kind: generationJobKindSchema,
  status: generationJobStatusSchema,
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  usage: tokenUsageSchema.optional(),
});

/**
 * What a job was asked for, by kind: a whole-score request for
 * `generate-score` and `generate-track`, a region request for the three
 * replace kinds. The one union every stored job request narrows to.
 */
export type GenerationJobRequest =
  | GenerateScoreRequest
  | RegenerateRegionRequest;

/**
 * A job together with what it was asked for — what `GET /projects/:id/jobs`
 * lists, so a project's history can show the brief each job was written to.
 *
 * A separate type rather than a field on `GenerationJob`, which rides on
 * every live-stream frame and every poll: a region request carries the
 * selected fragment and its context, and sending that on each heartbeat
 * would be a score's worth of bytes nothing on the stream reads.
 */
export type GenerationJobDetail = GenerationJob & {
  request: GenerationJobRequest;
};

export const generationJobDetailSchema = generationJobSchema.extend({
  request: z.union([
    generateScoreRequestSchema,
    regenerateRegionRequestSchema,
  ]),
});

/**
 * `request` is the whole provider request, stored verbatim so the job never
 * re-reads the project. Its shape varies by `kind`, so it is unknown here and
 * narrowed by the runner.
 */
export type CreateGenerationJobRequest = {
  projectId: UUID;
  kind: GenerationJobKind;
  request: unknown;
};

export const createGenerationJobRequestSchema = z.object({
  projectId: z.string().min(1),
  kind: generationJobKindSchema,
  request: z.unknown(),
});

/** Parses and validates untrusted JSON as a `GenerateScoreRequest`. Throws `ZodError` on invalid input. */
export function parseGenerateScoreRequest(json: unknown): GenerateScoreRequest {
  return generateScoreRequestSchema.parse(json) as GenerateScoreRequest;
}

/** Parses and validates untrusted JSON as a `GenerateScoreResult`. Throws `ZodError` on invalid input. */
export function parseGenerateScoreResult(json: unknown): GenerateScoreResult {
  return generateScoreResultSchema.parse(json) as GenerateScoreResult;
}

/** Parses and validates untrusted JSON as a `RegenerateRegionRequest`. Throws `ZodError` on invalid input. */
export function parseRegenerateRegionRequest(
  json: unknown,
): RegenerateRegionRequest {
  return regenerateRegionRequestSchema.parse(json) as RegenerateRegionRequest;
}

/** Parses and validates untrusted JSON as a `RegenerateRegionResult`. Throws `ZodError` on invalid input. */
export function parseRegenerateRegionResult(
  json: unknown,
): RegenerateRegionResult {
  return regenerateRegionResultSchema.parse(json) as RegenerateRegionResult;
}

/** Parses and validates untrusted JSON as a `RegenerationCandidate`. Throws `ZodError` on invalid input. */
export function parseRegenerationCandidate(
  json: unknown,
): RegenerationCandidate {
  return regenerationCandidateSchema.parse(json) as RegenerationCandidate;
}
