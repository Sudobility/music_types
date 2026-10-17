import { describe, expect, it } from "vitest";
import {
  scoreLine,
  scoreLyricFit,
  toneTransitionClashes,
  type LyricLine,
} from "./lyric-fit";

describe("toneTransitionClashes", () => {
  it("flags a falling melody under a rising tone transition", () => {
    // tone 3 (dips low) -> tone 2 (rises): implied upward; melody falls.
    expect(toneTransitionClashes(3, 2, 67, 60)).toBe(true);
  });

  it("accepts a melody that agrees with the tones", () => {
    // tone 3 -> tone 2 implies upward; melody rises.
    expect(toneTransitionClashes(3, 2, 60, 67)).toBe(false);
  });

  it("never clashes on a level implication or a unison", () => {
    expect(toneTransitionClashes(1, 1, 60, 72)).toBe(false); // high-level -> high-level
    expect(toneTransitionClashes(4, 2, 64, 64)).toBe(false); // melody unison
  });
});

describe("scoreLine tone rule", () => {
  it("penalises each contradicting pair", () => {
    const line: LyricLine = {
      syllables: [
        { text: "a", midi: 67, tone: 3 },
        { text: "b", midi: 60, tone: 2 }, // clash: implied up, melody down
        { text: "c", midi: 67, tone: 3 }, // clash: implied down, melody up
      ],
    };
    expect(scoreLine(line).tone).toBe(2);
  });

  it("ignores syllables with no tone (e.g. English)", () => {
    const line: LyricLine = {
      syllables: [
        { text: "a", midi: 60 },
        { text: "b", midi: 48 },
      ],
    };
    expect(scoreLine(line).tone).toBe(0);
  });
});

describe("scoreLine beat rule", () => {
  it("penalises a content word on a weak beat and a function word on a strong beat", () => {
    const line: LyricLine = {
      syllables: [
        { text: "the", midi: 60, contentWord: false, strongBeat: true }, // wrong
        { text: "sun", midi: 62, contentWord: true, strongBeat: false }, // wrong
        { text: "shines", midi: 64, contentWord: true, strongBeat: true }, // ok
      ],
    };
    expect(scoreLine(line).beat).toBe(2);
  });
});

describe("scoreLine cadence rule", () => {
  it("penalises a statement that ends above where it began and on its peak", () => {
    const line: LyricLine = {
      ending: "statement",
      syllables: [
        { text: "go", midi: 60 },
        { text: "ing", midi: 62 },
        { text: "up", midi: 67 },
      ],
    };
    expect(scoreLine(line).cadence).toBe(2);
  });

  it("is happy with a statement that settles down", () => {
    const line: LyricLine = {
      ending: "statement",
      syllables: [
        { text: "come", midi: 67 },
        { text: "back", midi: 62 },
        { text: "home", midi: 60 },
      ],
    };
    expect(scoreLine(line).cadence).toBe(0);
  });

  it("lets a question rise", () => {
    const line: LyricLine = {
      ending: "question",
      syllables: [
        { text: "are", midi: 60 },
        { text: "you", midi: 67 },
      ],
    };
    expect(scoreLine(line).cadence).toBe(0);
  });
});

describe("scoreLyricFit", () => {
  it("sums the per-line penalties", () => {
    const lines: LyricLine[] = [
      {
        ending: "statement",
        syllables: [
          { text: "up", midi: 60 },
          { text: "high", midi: 67 },
        ],
      },
      {
        syllables: [
          { text: "a", midi: 67, tone: 3 },
          { text: "b", midi: 60, tone: 2 },
        ],
      },
    ];
    const score = scoreLyricFit(lines);
    expect(score.cadence).toBe(2);
    expect(score.tone).toBe(1);
    expect(score.total).toBe(3);
  });

  it("scores an empty lyric at zero", () => {
    expect(scoreLyricFit([])).toEqual({ total: 0, tone: 0, beat: 0, cadence: 0 });
  });
});
