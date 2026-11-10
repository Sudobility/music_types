/**
 * The paper a score prints on, as vocabulary and picker options.
 *
 * The paper model now lives in `@sudobility/printing_core`, which the web and
 * React Native printing libraries also build on; this file re-exports it so
 * music_types consumers keep their imports unchanged and there is one
 * definition of the paper vocabulary. The page geometry that uses these —
 * dimensions, margins, the usable page — is `printing_core`'s geometry and
 * music_drawing's pagination.
 */
export type { PaperOrientation, PaperSize } from "@sudobility/printing_core";
export {
  PAPER_ORIENTATIONS,
  PAPER_OPTIONS,
  PAPER_SIZES,
  ORIENTATION_OPTIONS,
  defaultPaperSizeFor,
} from "@sudobility/printing_core";
