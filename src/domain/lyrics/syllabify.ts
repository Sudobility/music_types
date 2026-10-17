/**
 * Splitting lyric text into the syllables that sit on notes.
 *
 * One rule, in one place, for every surface that turns written words into the
 * per-note `Lyric` the model stores. The backend's generation service and the
 * apps' lyric-entry bar both did this for themselves — the backend respecting
 * only the hyphens a model happened to supply, the app splitting on the first
 * separator it saw — so "beau-ti-ful" and "beautiful" became different data
 * depending on who typed them. This is the shared answer both call.
 *
 * Two inputs, two languages.
 *
 * A lyricist writes syllables with punctuation a lyric sheet already uses: a
 * space separates words, a hyphen splits a word across notes ("sum-mer" is
 * "sum" then "mer"). That spelling is *authoritative* — a human or a model that
 * bothered to hyphenate has said exactly where the breaks go, and we never
 * second-guess it. Only a word with no hyphen is split automatically, and only
 * then does the language matter:
 *
 * - **English** has no one-to-one letter-to-syllable rule, so an automatic split
 *   is a heuristic (maximal legal onset over vowel groups, below). It is correct
 *   for the common shapes ("mu-sic", "win-dow", "sum-mer") and approximate at
 *   the edges (silent *e*, the "-le" ending); it is a *fallback* for un-marked
 *   words, never a replacement for a supplied hyphenation. Ambiguous single-
 *   syllable words ("wave", "time") are left whole by the vowel-count guard.
 * - **Chinese** is exact: one Han character is one syllable on one note (字),
 *   so there is nothing to guess — the text is split character by character.
 *
 * Pure, synchronous, and dependency-free, so it holds on both the frontend and
 * the backend. The English rules carry no dictionary: a Liang/TeX pattern table
 * would raise accuracy but is a data dependency this package does not take, and
 * the supplied-hyphen path is what production leans on.
 */

import type { Lyric, Syllabic } from "../../model/score";

/** Which language's automatic-split rules apply to an un-hyphenated word. */
export type LyricLanguage = "en" | "zh";

const VOWELS = "aeiouy";

/**
 * Consonant clusters that can legally begin an English syllable.
 *
 * Used by the maximal-onset split: of a consonant run between two vowels, the
 * longest suffix that is a legal onset becomes the next syllable's onset and the
 * rest is the previous syllable's coda. "nd" is not here, so "window" breaks
 * "win-dow"; "mm" is not here, so "summer" breaks "sum-mer". Single consonants
 * are always legal onsets and are not listed.
 */
const LEGAL_ONSETS: ReadonlySet<string> = new Set([
  "bl", "br", "ch", "cl", "cr", "dr", "dw", "fl", "fr", "gl", "gr", "gw",
  "kl", "kr", "kw", "ph", "pl", "pr", "qu", "sc", "sh", "sk", "sl", "sm",
  "sn", "sp", "st", "sw", "th", "tr", "tw", "wh", "wr",
  "scr", "shr", "spl", "spr", "squ", "str", "thr",
]);

const isVowel = (ch: string): boolean => VOWELS.includes(ch.toLowerCase());

/** Whether a character is a Han ideograph — the unit a Chinese lyric sings. */
const isHan = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // Extension A
    (code >= 0xf900 && code <= 0xfaff) // Compatibility Ideographs
  );
};

/**
 * How many syllables an English word has, by vowel groups.
 *
 * A maximal run of vowel letters is one syllable nucleus ("beau" is one, not
 * three). A single trailing silent *e* after a consonant ("wave", "time") is
 * not its own syllable and is discounted — but never below one, and never the
 * "-le" ending ("apple", "table"), where the *e* does carry a syllable.
 *
 * Rough by design: it exists to *guard* the automatic split (a word it counts
 * as one syllable is returned whole) and to let callers sanity-check a supplied
 * hyphenation, not to be a pronunciation oracle.
 */
export function estimateEnglishSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w === "") return 0;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  // Silent trailing e: "...Ce" but not "...Cle".
  if (count > 1 && w.endsWith("e") && !isVowel(w[w.length - 2] ?? "")) {
    if (!/[^aeiouy]le$/.test(w)) count -= 1;
  }
  return Math.max(1, count);
}

/**
 * Split a Chinese lyric into its per-note syllables.
 *
 * Every Han character is one syllable; anything else (Latin letters mixed in, a
 * stray numeral) is grouped into runs and kept as single tokens so a bilingual
 * line does not lose its non-Han words. Whitespace is dropped.
 */
export function splitHanCharacters(text: string): string[] {
  const out: string[] = [];
  let latin = "";
  const flush = (): void => {
    const trimmed = latin.trim();
    if (trimmed !== "") out.push(trimmed);
    latin = "";
  };
  for (const ch of text) {
    if (isHan(ch)) {
      flush();
      out.push(ch);
    } else if (/\s/.test(ch)) {
      flush();
    } else {
      latin += ch;
    }
  }
  flush();
  return out;
}

/**
 * Split one un-hyphenated English word into syllables, best effort.
 *
 * Vowel groups are the nuclei; the consonant run between two nuclei is divided
 * by the maximal-onset rule (longest legal-onset suffix to the next syllable,
 * the rest to the previous coda). Leading consonants join the first nucleus and
 * trailing consonants the last. A word the vowel-count guard calls monosyllabic
 * is returned whole, which is what keeps silent-*e* words ("wave") intact.
 */
export function splitEnglishSyllables(word: string): string[] {
  if (word.length <= 2 || estimateEnglishSyllables(word) <= 1) return [word];

  const lower = word.toLowerCase();
  // Vowel-group spans as [start, endExclusive).
  const nuclei: Array<[number, number]> = [];
  for (let i = 0; i < lower.length; i += 1) {
    if (isVowel(lower[i])) {
      const start = i;
      while (i + 1 < lower.length && isVowel(lower[i + 1])) i += 1;
      nuclei.push([start, i + 1]);
    }
  }
  if (nuclei.length <= 1) return [word];

  // A break index before each syllable after the first.
  const breaks: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n += 1) {
    const clusterStart = nuclei[n][1];
    const clusterEnd = nuclei[n + 1][0];
    const cluster = lower.slice(clusterStart, clusterEnd);
    if (cluster.length === 0) {
      // Hiatus: two adjacent vowel groups the letters can't tell apart. Keep
      // them together rather than guess a break inside "poem"-shaped words.
      continue;
    }
    // Longest suffix that is a legal onset; always leave the previous syllable
    // at least its nucleus, so a single consonant goes to the onset.
    let onsetLen = 1;
    for (let len = Math.min(cluster.length, 3); len >= 2; len -= 1) {
      if (LEGAL_ONSETS.has(cluster.slice(cluster.length - len))) {
        onsetLen = len;
        break;
      }
    }
    onsetLen = Math.min(onsetLen, cluster.length);
    breaks.push(clusterEnd - onsetLen);
  }

  if (breaks.length === 0) return [word];
  const pieces: string[] = [];
  let from = 0;
  for (const at of breaks) {
    pieces.push(word.slice(from, at));
    from = at;
  }
  pieces.push(word.slice(from));
  return pieces.filter((p) => p !== "");
}

/**
 * Split one written word into syllables.
 *
 * A supplied hyphenation wins outright: "sum-mer" is `["sum", "mer"]` in either
 * language, because somebody already decided the breaks. Only a word with no
 * hyphen is split automatically — per character for Chinese, by the English
 * heuristic otherwise.
 */
export function splitWord(word: string, language: LyricLanguage): string[] {
  const trimmed = word.trim();
  if (trimmed === "") return [];
  if (trimmed.includes("-")) {
    return trimmed.split("-").filter((part) => part !== "");
  }
  return language === "zh"
    ? splitHanCharacters(trimmed)
    : splitEnglishSyllables(trimmed);
}

const syllabicOf = (index: number, count: number): Syllabic | undefined => {
  if (count <= 1) return undefined; // `single`, which `Lyric` leaves absent.
  if (index === 0) return "begin";
  if (index === count - 1) return "end";
  return "middle";
};

/** One word's syllables as `Lyric`s, with the joins that draw whole words. */
function wordToLyrics(parts: readonly string[]): Lyric[] {
  return parts.map((text, index) => {
    const syllabic = syllabicOf(index, parts.length);
    return syllabic ? { text, syllabic } : { text };
  });
}

/**
 * Turn a line of lyric text into the per-note `Lyric` syllables it sings.
 *
 * Words are separated by whitespace and each is split by {@link splitWord}; the
 * result is one flat list in reading order, each syllable carrying the
 * `begin`/`middle`/`end` join that lets the renderer draw the word's hyphens (a
 * one-syllable word is left `single`, i.e. no `syllabic`). Pass
 * `autoHyphenate: false` to honour only the hyphens already in the text and
 * leave every other word whole — the conservative mode for when a caller does
 * not want the English heuristic to guess.
 */
export function syllabifyText(
  text: string,
  language: LyricLanguage,
  options: { autoHyphenate?: boolean } = {},
): Lyric[] {
  const autoHyphenate = options.autoHyphenate ?? true;
  if (language === "zh") {
    // Chinese needs no word splitting: every character is its own note.
    return splitHanCharacters(text).map((ch) => ({ text: ch }));
  }
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "")
    .flatMap((word) => {
      if (!autoHyphenate && !word.includes("-")) return [{ text: word }];
      return wordToLyrics(splitWord(word, language));
    });
}
