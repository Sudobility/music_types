/**
 * Putting a line of lyrics onto a track that already has a tune.
 *
 * The score-level counterpart to `distributeSyllables`: that decides which
 * syllable sits on which sung moment; this reads those moments off a real
 * `Score` track, runs the distribution, and writes the result back as a new
 * `Score`. It is what a "write/align lyrics for this melody" operation calls —
 * on the server, against a project's vocal track, or in the app, against the
 * notes a reader selected — so the two cannot disagree about where the words go.
 *
 * What it does, concretely:
 *
 * - Collects the track's sung moments in time order, a chord counted once (the
 *   renderer draws one word per chord), as `distributeSyllables` expects.
 * - Lays the syllables on them, so a word that outlasts its note is held across
 *   the next notes (a melisma): those notes have their lyric *cleared*, which is
 *   exactly how this family carries a melisma and what the MusicXML exporter
 *   turns into an `<extend/>`.
 * - Clears any stale lyric on a chord's non-root notes and on notes past the end
 *   of the words, so the track sings the new line and nothing left over from an
 *   old one.
 *
 * Note splitting is deliberately not done here: giving more syllables than the
 * tune has notes returns the overflow as `leftover` rather than carving up the
 * composed rhythm, which is a heavier edit a caller should ask for explicitly
 * (and apply to the model itself). Pure, synchronous, dependency-free.
 */

import type { Lyric, NoteEvent, Score } from "../../model/score";
import { isNoteEvent } from "../../model/score";
import { distributeSyllables } from "./distribute-syllables";

export type AlignLyricsResult = {
  /** The score with the track's lyrics rewritten. Unchanged if the track has no sung notes. */
  score: Score;
  /** How many syllables were placed on a note. */
  applied: number;
  /** Syllables that did not fit — more words than the tune has notes. */
  leftover: Lyric[];
};

/** A sung moment: the note that carries its word, and where it sits in time. */
type Moment = { noteId: string; startTick: number; durationTicks: number };

/**
 * The track's sung moments in time order, a chord counted once.
 *
 * A note is grouped with any earlier note at the same tick; the first in
 * document order carries the moment's word, and the rest are chord members whose
 * ids are returned so a caller can clear any stale lyric on them.
 */
function sungMoments(track: Score["tracks"][number]): {
  moments: Moment[];
  chordMemberIds: Set<string>;
} {
  const notes: NoteEvent[] = [];
  for (const measure of track.measures) {
    for (const voice of measure.voices) {
      for (const event of voice.events) {
        if (isNoteEvent(event)) notes.push(event);
      }
    }
  }
  notes.sort((a, b) => a.startTick - b.startTick);

  const moments: Moment[] = [];
  const chordMemberIds = new Set<string>();
  let lastTick: number | null = null;
  for (const note of notes) {
    if (note.startTick === lastTick) {
      chordMemberIds.add(note.id);
      continue;
    }
    lastTick = note.startTick;
    moments.push({
      noteId: note.id,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
    });
  }
  return { moments, chordMemberIds };
}

/** Rewrite one note's lyric: set it, or (when `lyric` is null) remove it. */
function withLyric(note: NoteEvent, lyric: Lyric | null): NoteEvent {
  if (lyric) return { ...note, lyric };
  if (note.lyric === undefined) return note;
  const copy: NoteEvent = { ...note };
  delete copy.lyric;
  return copy;
}

/**
 * Align `syllables` onto `trackId`'s melody, returning a new score.
 *
 * The syllables are the words already split (see `syllabifyText`). A track with
 * no sung notes, or an unknown id, comes back unchanged with nothing applied.
 */
export function alignLyricsToTrack(
  score: Score,
  trackId: string,
  syllables: readonly Lyric[],
): AlignLyricsResult {
  const track = score.tracks.find((t) => t.id === trackId);
  if (!track) return { score, applied: 0, leftover: [...syllables] };

  const { moments, chordMemberIds } = sungMoments(track);
  if (moments.length === 0) return { score, applied: 0, leftover: [...syllables] };

  const distribution = distributeSyllables(moments, syllables);

  // Each slot runs parallel to a moment (no splitting), so the moment's note id
  // tells us which note to write.
  const lyricByNoteId = new Map<string, Lyric | null>();
  let applied = 0;
  distribution.slots.forEach((slot, index) => {
    const moment = moments[index];
    if (!moment) return;
    lyricByNoteId.set(moment.noteId, slot.lyric);
    if (slot.lyric) applied += 1;
  });
  // A chord's non-root notes never carry the word; clear any stale lyric on them.
  for (const id of chordMemberIds) lyricByNoteId.set(id, null);

  const tracks = score.tracks.map((t) => {
    if (t.id !== trackId) return t;
    return {
      ...t,
      measures: t.measures.map((measure) => ({
        ...measure,
        voices: measure.voices.map((voice) => ({
          ...voice,
          events: voice.events.map((event) =>
            isNoteEvent(event) && lyricByNoteId.has(event.id)
              ? withLyric(event, lyricByNoteId.get(event.id) ?? null)
              : event,
          ),
        })),
      })),
    };
  });

  return { score: { ...score, tracks }, applied, leftover: distribution.leftover };
}
