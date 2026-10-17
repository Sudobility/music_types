/**
 * Distributing a line's syllables onto the notes that sing them.
 *
 * The step between "here are the words, split into syllables" and "here is the
 * lyric on each note". It is the one rule that has to agree across the family:
 * the backend fitting a re-lyriced verse and the app's lyric-entry bar both have
 * to decide what happens when the words and the notes do not line up one to one,
 * and until now each did something different and neither handled a melisma.
 *
 * The model is OpenUtau's, adapted to our tick-based score:
 *
 * - **One syllable, one note**, in order. The common case, and the whole of it
 *   when the counts match.
 * - **More notes than syllables → a melisma.** The leftover notes at the end do
 *   not fall silent and they do not re-articulate a word; they *sustain the last
 *   syllable's vowel*. Each is returned with no lyric of its own and
 *   `melisma: true`, which is what an exporter turns into a MusicXML `<extend/>`
 *   and what tells a reader the word is held, not that the notes are
 *   instrumental. (A note sung before any syllable at all is simply wordless, not
 *   a melisma — there is no vowel yet to hold.)
 * - **More syllables than notes.** By default the syllables that do not fit are
 *   returned as `leftover` and nothing is forced on; with `splitNotes` the last
 *   note is divided into as many pieces as the remaining syllables need (bounded
 *   by `minSplitTicks`, so a note is never split into slivers), each piece
 *   singing one syllable — OpenUtau's `HandleNotEnoughNotes`.
 *
 * The result is a flat list of *slots*. A slot is one sung moment: usually a
 * whole note, but a split note contributes several slots that share its
 * `sourceIndex` and divide its duration. The caller maps slots back to real
 * notes — set the lyric on a plain slot, clear it on a melisma slot, and replace
 * a split note with the pieces its slots describe.
 *
 * Pure, synchronous, dependency-free, and model-light: it reads only each note's
 * start and length, so the caller passes the *sung moments* (a chord counted
 * once, as the renderer draws one word per chord) rather than raw events.
 */

import type { Lyric } from "../../model/score";

/** The minimum a note contributes to the distribution: where it is, how long. */
export type DistributableNote = {
  startTick: number;
  durationTicks: number;
};

/** One sung moment after distribution. */
export type DistributedSlot = {
  /** Index into the input `notes` this slot came from. */
  sourceIndex: number;
  /** Where this slot begins — the note's start, or a piece offset within it. */
  startTick: number;
  /** This slot's length: the note's, or its share of a split note. */
  durationTicks: number;
  /** The syllable sung here, or `null` when the slot sings no new word. */
  lyric: Lyric | null;
  /** The slot sustains the previous syllable's vowel (a melisma extension). */
  melisma: boolean;
};

export type SyllableDistribution = {
  /** The sung moments, in order; more than one per note where a note was split. */
  slots: DistributedSlot[];
  /** Syllables that did not fit, when `splitNotes` is off or splitting ran out. */
  leftover: Lyric[];
  /** Source indices of notes that were split to make room. */
  splitNotes: number[];
};

export type DistributeOptions = {
  /**
   * When syllables outnumber notes, split the last note into enough pieces to
   * carry the remaining syllables. Off by default: splitting a note changes the
   * composed rhythm, which is a decision the caller should opt into.
   */
  splitNotes?: boolean;
  /** The shortest piece a split may produce, in ticks. Default 60 (a 32nd at 480 PPQ). */
  minSplitTicks?: number;
};

/** Divide `total` into `pieces` whole-tick lengths that sum back to `total`. */
function evenSplit(total: number, pieces: number): number[] {
  const base = Math.floor(total / pieces);
  const remainder = total - base * pieces;
  // The earliest pieces absorb the remainder, so the sum is exactly `total`.
  return Array.from({ length: pieces }, (_, k) => base + (k < remainder ? 1 : 0));
}

/**
 * Lay a line's syllables onto its notes, handling melismas and over-long lines.
 *
 * `notes` are the sung moments in time order (a chord is one moment);
 * `syllables` are the words already split (see `syllabifyText`). The result's
 * `slots` run parallel to the music in time order.
 */
export function distributeSyllables(
  notes: readonly DistributableNote[],
  syllables: readonly Lyric[],
  options: DistributeOptions = {},
): SyllableDistribution {
  const splitNotes = options.splitNotes ?? false;
  const minSplitTicks = options.minSplitTicks ?? 60;

  if (notes.length === 0) {
    return { slots: [], leftover: [...syllables], splitNotes: [] };
  }

  const slots: DistributedSlot[] = [];
  const splitIndices: number[] = [];
  let leftover: Lyric[] = [];

  // Every note but the last takes at most one syllable; the last note is where
  // any overflow is split, so it is handled separately.
  const lastIndex = notes.length - 1;

  for (let i = 0; i < lastIndex; i += 1) {
    const note = notes[i];
    const lyric = syllables[i] ?? null;
    slots.push({
      sourceIndex: i,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      lyric,
      // A note past the end of the words sustains the last one — unless no word
      // has been sung yet, in which case it is simply instrumental.
      melisma: lyric === null && i >= 1 && syllables.length > 0 && syllables.length <= i,
    });
  }

  const last = notes[lastIndex];
  const remaining = syllables.slice(lastIndex); // syllables from the last note on

  if (remaining.length <= 1) {
    // The last note takes its one syllable, or sustains the last if the words
    // already ran out before it.
    const lyric = remaining[0] ?? null;
    slots.push({
      sourceIndex: lastIndex,
      startTick: last.startTick,
      durationTicks: last.durationTicks,
      lyric,
      melisma: lyric === null && lastIndex >= 1 && syllables.length > 0,
    });
    return { slots, leftover, splitNotes: splitIndices };
  }

  // More than one syllable still wants the last note.
  if (!splitNotes) {
    // Keep the first on the note; the rest do not fit.
    slots.push({
      sourceIndex: lastIndex,
      startTick: last.startTick,
      durationTicks: last.durationTicks,
      lyric: remaining[0],
      melisma: false,
    });
    leftover = remaining.slice(1);
    return { slots, leftover, splitNotes: splitIndices };
  }

  // Split the last note into as many pieces as will fit, one syllable each.
  const maxPieces = Math.max(1, Math.floor(last.durationTicks / minSplitTicks));
  const pieces = Math.min(remaining.length, maxPieces);
  if (pieces > 1) splitIndices.push(lastIndex);
  if (pieces < remaining.length) leftover = remaining.slice(pieces);

  const lengths = evenSplit(last.durationTicks, pieces);
  let offset = last.startTick;
  for (let p = 0; p < pieces; p += 1) {
    slots.push({
      sourceIndex: lastIndex,
      startTick: offset,
      durationTicks: lengths[p],
      lyric: remaining[p],
      melisma: false,
    });
    offset += lengths[p];
  }

  return { slots, leftover, splitNotes: splitIndices };
}
