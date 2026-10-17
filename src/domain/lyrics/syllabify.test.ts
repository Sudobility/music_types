import { describe, expect, it } from "vitest";
import {
  estimateEnglishSyllables,
  splitEnglishSyllables,
  splitHanCharacters,
  splitWord,
  syllabifyText,
} from "./syllabify";

describe("estimateEnglishSyllables", () => {
  it("counts vowel groups as one nucleus each", () => {
    expect(estimateEnglishSyllables("beautiful")).toBe(3);
    expect(estimateEnglishSyllables("music")).toBe(2);
    expect(estimateEnglishSyllables("rain")).toBe(1);
  });

  it("discounts a silent trailing e but keeps the -le ending", () => {
    expect(estimateEnglishSyllables("wave")).toBe(1);
    expect(estimateEnglishSyllables("time")).toBe(1);
    expect(estimateEnglishSyllables("apple")).toBe(2);
  });

  it("never drops below one", () => {
    expect(estimateEnglishSyllables("the")).toBe(1);
    expect(estimateEnglishSyllables("")).toBe(0);
  });
});

describe("splitEnglishSyllables", () => {
  it("splits common words by maximal onset", () => {
    expect(splitEnglishSyllables("music")).toEqual(["mu", "sic"]);
    expect(splitEnglishSyllables("window")).toEqual(["win", "dow"]);
    expect(splitEnglishSyllables("summer")).toEqual(["sum", "mer"]);
    expect(splitEnglishSyllables("garden")).toEqual(["gar", "den"]);
    expect(splitEnglishSyllables("yellow")).toEqual(["yel", "low"]);
    expect(splitEnglishSyllables("open")).toEqual(["o", "pen"]);
  });

  it("keeps a legal onset cluster together", () => {
    expect(splitEnglishSyllables("hello")).toEqual(["hel", "lo"]);
    expect(splitEnglishSyllables("happy")).toEqual(["hap", "py"]);
  });

  it("leaves a monosyllable (incl. silent e) whole", () => {
    expect(splitEnglishSyllables("wave")).toEqual(["wave"]);
    expect(splitEnglishSyllables("rain")).toEqual(["rain"]);
    expect(splitEnglishSyllables("eye")).toEqual(["eye"]);
  });
});

describe("splitHanCharacters", () => {
  it("splits one syllable per Han character", () => {
    expect(splitHanCharacters("月亮")).toEqual(["月", "亮"]);
    expect(splitHanCharacters("我爱你")).toEqual(["我", "爱", "你"]);
  });

  it("drops whitespace and keeps embedded latin runs whole", () => {
    expect(splitHanCharacters("月 亮")).toEqual(["月", "亮"]);
    expect(splitHanCharacters("ok月")).toEqual(["ok", "月"]);
  });
});

describe("splitWord", () => {
  it("honours a supplied hyphenation in either language", () => {
    expect(splitWord("sum-mer", "en")).toEqual(["sum", "mer"]);
    expect(splitWord("beau-ti-ful", "zh")).toEqual(["beau", "ti", "ful"]);
  });

  it("auto-splits only when there is no hyphen", () => {
    expect(splitWord("music", "en")).toEqual(["mu", "sic"]);
    expect(splitWord("月亮", "zh")).toEqual(["月", "亮"]);
  });
});

describe("syllabifyText", () => {
  it("assigns begin/middle/end joins across a word", () => {
    expect(syllabifyText("beautiful", "en")).toEqual([
      { text: "beau", syllabic: "begin" },
      { text: "ti", syllabic: "middle" },
      { text: "ful", syllabic: "end" },
    ]);
  });

  it("leaves a one-syllable word as single (no syllabic)", () => {
    expect(syllabifyText("rain falls", "en")).toEqual([
      { text: "rain" },
      { text: "falls" },
    ]);
  });

  it("respects a supplied hyphenation over the heuristic", () => {
    expect(syllabifyText("sun-shine", "en")).toEqual([
      { text: "sun", syllabic: "begin" },
      { text: "shine", syllabic: "end" },
    ]);
  });

  it("gives every Chinese character its own single lyric", () => {
    expect(syllabifyText("月亮", "zh")).toEqual([
      { text: "月" },
      { text: "亮" },
    ]);
  });

  it("with autoHyphenate off, keeps un-hyphenated words whole", () => {
    expect(syllabifyText("beautiful sun-shine", "en", { autoHyphenate: false })).toEqual([
      { text: "beautiful" },
      { text: "sun", syllabic: "begin" },
      { text: "shine", syllabic: "end" },
    ]);
  });
});
