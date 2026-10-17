import { describe, expect, it } from "vitest";
import {
  distributeSyllables,
  type DistributableNote,
} from "./distribute-syllables";
import type { Lyric } from "../../model/score";

const notes = (count: number, dur = 480): DistributableNote[] =>
  Array.from({ length: count }, (_, i) => ({
    startTick: i * dur,
    durationTicks: dur,
  }));

const words = (...texts: string[]): Lyric[] => texts.map((text) => ({ text }));

describe("distributeSyllables — one to one", () => {
  it("places one syllable on each note", () => {
    const result = distributeSyllables(notes(3), words("a", "b", "c"));
    expect(result.slots.map((s) => s.lyric?.text)).toEqual(["a", "b", "c"]);
    expect(result.slots.every((s) => !s.melisma)).toBe(true);
    expect(result.leftover).toEqual([]);
    expect(result.splitNotes).toEqual([]);
  });
});

describe("distributeSyllables — more notes than syllables (melisma)", () => {
  it("holds the last syllable across the trailing notes", () => {
    const result = distributeSyllables(notes(4), words("a", "b"));
    expect(result.slots.map((s) => s.lyric?.text ?? null)).toEqual([
      "a",
      "b",
      null,
      null,
    ]);
    expect(result.slots.map((s) => s.melisma)).toEqual([false, false, true, true]);
    expect(result.leftover).toEqual([]);
  });

  it("treats notes before any word as instrumental, not melisma", () => {
    const result = distributeSyllables(notes(2), []);
    expect(result.slots.map((s) => s.lyric)).toEqual([null, null]);
    expect(result.slots.map((s) => s.melisma)).toEqual([false, false]);
  });

  it("extends a single syllable over every later note", () => {
    const result = distributeSyllables(notes(3), words("oh"));
    expect(result.slots.map((s) => s.lyric?.text ?? null)).toEqual([
      "oh",
      null,
      null,
    ]);
    expect(result.slots.map((s) => s.melisma)).toEqual([false, true, true]);
  });
});

describe("distributeSyllables — more syllables than notes", () => {
  it("reports the overflow as leftover by default", () => {
    const result = distributeSyllables(notes(2), words("a", "b", "c"));
    expect(result.slots.map((s) => s.lyric?.text)).toEqual(["a", "b"]);
    expect(result.leftover.map((l) => l.text)).toEqual(["c"]);
    expect(result.splitNotes).toEqual([]);
  });

  it("splits the last note to make room when asked", () => {
    const result = distributeSyllables(notes(2), words("a", "b", "c", "d"), {
      splitNotes: true,
    });
    expect(result.slots.map((s) => s.lyric?.text)).toEqual(["a", "b", "c", "d"]);
    expect(result.splitNotes).toEqual([1]);
    expect(result.leftover).toEqual([]);
    // The split pieces share the last note's source index and divide its time.
    const pieces = result.slots.filter((s) => s.sourceIndex === 1);
    expect(pieces).toHaveLength(3);
    expect(pieces.reduce((sum, p) => sum + p.durationTicks, 0)).toBe(480);
    expect(pieces.map((p) => p.startTick)).toEqual([480, 640, 800]);
  });

  it("stops splitting at minSplitTicks and leaves the rest over", () => {
    // A 120-tick note at minSplitTicks 60 can hold at most 2 pieces.
    const short: DistributableNote[] = [{ startTick: 0, durationTicks: 120 }];
    const result = distributeSyllables(short, words("a", "b", "c"), {
      splitNotes: true,
      minSplitTicks: 60,
    });
    expect(result.slots.map((s) => s.lyric?.text)).toEqual(["a", "b"]);
    expect(result.leftover.map((l) => l.text)).toEqual(["c"]);
    expect(result.slots.reduce((sum, s) => sum + s.durationTicks, 0)).toBe(120);
  });
});

describe("distributeSyllables — edges", () => {
  it("returns every syllable as leftover when there are no notes", () => {
    const result = distributeSyllables([], words("a", "b"));
    expect(result.slots).toEqual([]);
    expect(result.leftover.map((l) => l.text)).toEqual(["a", "b"]);
  });

  it("carries the syllabic join through onto its slot", () => {
    const line: Lyric[] = [
      { text: "sum", syllabic: "begin" },
      { text: "mer", syllabic: "end" },
    ];
    const result = distributeSyllables(notes(2), line);
    expect(result.slots.map((s) => s.lyric)).toEqual(line);
  });
});
