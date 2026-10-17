/**
 * Scoring how well a line of lyrics sits on the melody it is sung to.
 *
 * A grader, not a generator. The model (or a person) proposes words for a tune;
 * this says how singable the result is, as a penalty — lower is better — so a
 * caller can re-rank several candidate lyrics against the *actual notes* and
 * keep the one that fights the melody least. Inspired by Microsoft muzic's
 * ReLyMe, reduced to the three rules that need only the note pitches, the beats,
 * and the words themselves:
 *
 * 1. **Mandarin tone agreement (倒字 avoidance).** Each lexical tone has a pitch
 *    contour — level, rising, dipping, falling — and when the melody moves the
 *    opposite way between two adjacent syllables the word is heard as a
 *    *different* word. The penalty is the count of adjacent pairs whose melodic
 *    direction contradicts the direction their tones imply.
 * 2. **Stress on the beat.** A content (lexical) word wants a strong beat and a
 *    function word a weak one; the reverse makes a line trip. English has no
 *    tone, so this and rule 3 are all it is graded on.
 * 3. **Cadence at the line end.** A line that ends a statement should settle at
 *    or below where it began; one that asks a question may rise. A declarative
 *    line whose last note is its highest reads as unfinished.
 *
 * The exact ReLyMe interval bands are not reproduced — they are a published
 * table of constants this package does not vendor — so the tone rule here uses a
 * contour-direction model (Chao tone letters) rather than their precise
 * semitone windows. It catches the same wrong-tone transitions; calibrate
 * against ReLyMe's table if a caller needs their exact thresholds.
 *
 * Pure, synchronous, dependency-free. The caller supplies the facts this cannot
 * derive from pitch alone — the Mandarin tone of a syllable, whether a word is
 * lexical, where a beat is strong — because computing those needs a pinyin table
 * or a part-of-speech pass that belong outside this package.
 */

/** Mandarin lexical tones: 1 high-level, 2 rising, 3 dipping, 4 falling, 0 neutral. */
export type MandarinTone = 0 | 1 | 2 | 3 | 4;

/** One syllable as it was placed on a note, as the grader reads it. */
export type FittedSyllable = {
  /** The written syllable — used only for emptiness checks. */
  text: string;
  /** MIDI pitch of the note it sits on. */
  midi: number;
  /** Mandarin tone, when known; omit for languages without lexical tone. */
  tone?: MandarinTone;
  /** The note sits on a strong beat (downbeat or strong subdivision). */
  strongBeat?: boolean;
  /** A lexical word (noun, verb, …) rather than a function word (the, of, …). */
  contentWord?: boolean;
};

/** How a line ends, which decides the cadence rule applied to it. */
export type LineEnding = "statement" | "question";

/** A sung line: its syllables in order, and how it ends. */
export type LyricLine = {
  syllables: readonly FittedSyllable[];
  ending?: LineEnding;
};

/** The breakdown behind a fit score; every field is a penalty, 0 is ideal. */
export type LyricFitScore = {
  /** Sum of the three penalties — the single number to rank candidates by. */
  total: number;
  /** Adjacent pairs whose melody contradicts their tones (rule 1). */
  tone: number;
  /** Stressed/unstressed words on the wrong kind of beat (rule 2). */
  beat: number;
  /** Line endings that resolve the wrong way (rule 3). */
  cadence: number;
};

/**
 * The register a tone occupies, on Chao's 1 (low) to 5 (high) scale, as
 * [onset, offset]. The *direction* a tone implies between two syllables is read
 * from the earlier tone's offset to the later tone's onset.
 */
const TONE_CONTOUR: Record<MandarinTone, readonly [number, number]> = {
  1: [5, 5], // high level
  2: [3, 5], // rising
  3: [2, 1], // low dipping (the low body is what the next syllable follows)
  4: [5, 1], // falling
  0: [3, 3], // neutral — mid, carried by context
};

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Whether the melody between two toned syllables contradicts their tones.
 *
 * The tones imply a direction (first tone's offset level → second tone's onset
 * level); the melody moves by `laterMidi - earlierMidi`. A contradiction is a
 * clear move *against* a clear implied direction — same direction, a level
 * implication, or a unison melody never counts.
 */
export function toneTransitionClashes(
  earlier: MandarinTone,
  later: MandarinTone,
  earlierMidi: number,
  laterMidi: number,
): boolean {
  const implied = sign(TONE_CONTOUR[later][0] - TONE_CONTOUR[earlier][1]);
  const melody = sign(laterMidi - earlierMidi);
  if (implied === 0 || melody === 0) return false;
  return implied !== melody;
}

function toneScore(line: LyricLine): number {
  const syl = line.syllables;
  let clashes = 0;
  for (let i = 1; i < syl.length; i += 1) {
    const a = syl[i - 1];
    const b = syl[i];
    if (a.tone === undefined || b.tone === undefined) continue;
    if (toneTransitionClashes(a.tone, b.tone, a.midi, b.midi)) clashes += 1;
  }
  return clashes;
}

function beatScore(line: LyricLine): number {
  let wrong = 0;
  for (const s of line.syllables) {
    if (s.contentWord === undefined || s.strongBeat === undefined) continue;
    // A content word belongs on a strong beat; a function word on a weak one.
    if (s.contentWord !== s.strongBeat) wrong += 1;
  }
  return wrong;
}

function cadenceScore(line: LyricLine): number {
  const sung = line.syllables.filter((s) => s.text.trim() !== "");
  if (sung.length < 2) return 0;
  const first = sung[0].midi;
  const last = sung[sung.length - 1].midi;
  const peak = Math.max(...sung.map((s) => s.midi));
  if (line.ending === "question") {
    // A question may rise; penalise only a clear fall below where it started.
    return last < first ? 1 : 0;
  }
  // A statement should settle: its last note is at or below the opening, and is
  // not the single highest note of the line.
  let penalty = 0;
  if (last > first) penalty += 1;
  if (last >= peak && last > first) penalty += 1;
  return penalty;
}

/** Grade one sung line against its melody. */
export function scoreLine(line: LyricLine): LyricFitScore {
  const tone = toneScore(line);
  const beat = beatScore(line);
  const cadence = cadenceScore(line);
  return { total: tone + beat + cadence, tone, beat, cadence };
}

/** Grade a whole lyric, summing the per-line penalties. */
export function scoreLyricFit(lines: readonly LyricLine[]): LyricFitScore {
  return lines.reduce<LyricFitScore>(
    (acc, line) => {
      const s = scoreLine(line);
      return {
        total: acc.total + s.total,
        tone: acc.tone + s.tone,
        beat: acc.beat + s.beat,
        cadence: acc.cadence + s.cadence,
      };
    },
    { total: 0, tone: 0, beat: 0, cadence: 0 },
  );
}
