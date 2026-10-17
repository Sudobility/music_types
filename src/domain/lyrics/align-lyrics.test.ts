import { describe, expect, it } from "vitest";
import { createEmptyScore } from "../../test-helpers";
import { isNoteEvent } from "../../model/score";
import type { Lyric, NoteEvent, Score } from "../../model/score";
import { alignLyricsToTrack } from "./align-lyrics";
import { syllabifyText } from "./syllabify";

/** A one-measure score whose first track sings `moments` [startTick, pitch, lyric?]. */
function sungScore(
  moments: ReadonlyArray<[startTick: number, lyric?: Lyric]>,
): { score: Score; trackId: string } {
  const score = createEmptyScore({
    title: "t",
    measures: 1,
    tracks: [{ name: "Voice", midiProgram: 52 }],
  });
  const track = score.tracks[0];
  const voice = track.measures[0].voices[0];
  const notes: NoteEvent[] = moments.map(([startTick, lyric], i) => ({
    id: `n${i}`,
    pitch: { step: "C", accidental: 0, octave: 4 },
    startTick,
    durationTicks: 480,
    velocity: 80,
    voiceId: voice.id,
    trackId: track.id,
    ...(lyric ? { lyric } : {}),
  }));
  const next: Score = {
    ...score,
    tracks: score.tracks.map((t, ti) =>
      ti !== 0
        ? t
        : {
            ...t,
            measures: t.measures.map((m, mi) =>
              mi !== 0
                ? m
                : {
                    ...m,
                    voices: m.voices.map((v, vi) =>
                      vi !== 0 ? v : { ...v, events: notes },
                    ),
                  },
            ),
          },
    ),
  };
  return { score: next, trackId: track.id };
}

const lyricsOf = (score: Score, trackId: string): Array<Lyric | null> => {
  const track = score.tracks.find((t) => t.id === trackId)!;
  return track.measures
    .flatMap((m) => m.voices.flatMap((v) => v.events))
    .filter(isNoteEvent)
    .sort((a, b) => a.startTick - b.startTick)
    .map((e) => e.lyric ?? null);
};

describe("alignLyricsToTrack", () => {
  it("places one syllable per note, carrying syllabic joins", () => {
    const { score, trackId } = sungScore([[0], [480], [960]]);
    const result = alignLyricsToTrack(score, trackId, syllabifyText("beautiful", "en"));
    expect(result.applied).toBe(3);
    expect(result.leftover).toEqual([]);
    expect(lyricsOf(result.score, trackId)).toEqual([
      { text: "beau", syllabic: "begin" },
      { text: "ti", syllabic: "middle" },
      { text: "ful", syllabic: "end" },
    ]);
  });

  it("holds a word across the trailing notes as a melisma (lyric cleared)", () => {
    const { score, trackId } = sungScore([[0], [480], [960]]);
    const result = alignLyricsToTrack(score, trackId, [{ text: "oh" }]);
    expect(result.applied).toBe(1);
    expect(lyricsOf(result.score, trackId)).toEqual([{ text: "oh" }, null, null]);
  });

  it("returns the overflow when there are more syllables than notes", () => {
    const { score, trackId } = sungScore([[0], [480]]);
    const result = alignLyricsToTrack(score, trackId, [
      { text: "a" },
      { text: "b" },
      { text: "c" },
    ]);
    expect(result.applied).toBe(2);
    expect(result.leftover).toEqual([{ text: "c" }]);
    expect(lyricsOf(result.score, trackId)).toEqual([{ text: "a" }, { text: "b" }]);
  });

  it("clears stale lyrics the new line does not reach", () => {
    const { score, trackId } = sungScore([
      [0, { text: "old1" }],
      [480, { text: "old2" }],
      [960, { text: "old3" }],
    ]);
    const result = alignLyricsToTrack(score, trackId, [{ text: "new" }]);
    expect(lyricsOf(result.score, trackId)).toEqual([{ text: "new" }, null, null]);
  });

  it("gives a chord's word to one note and clears the rest", () => {
    // Two notes share tick 0 (a chord); the next note is at 480.
    const { score, trackId } = sungScore([[0], [0], [480]]);
    const result = alignLyricsToTrack(score, trackId, [{ text: "x" }, { text: "y" }]);
    // One word on the chord's first note, one on the next note; the chord's
    // second note carries none.
    const lyrics = lyricsOf(result.score, trackId);
    expect(lyrics.filter((l) => l !== null)).toHaveLength(2);
    expect(result.applied).toBe(2);
  });

  it("leaves an unknown track untouched", () => {
    const { score } = sungScore([[0]]);
    const result = alignLyricsToTrack(score, "nope", [{ text: "a" }]);
    expect(result.score).toBe(score);
    expect(result.applied).toBe(0);
    expect(result.leftover).toEqual([{ text: "a" }]);
  });
});
