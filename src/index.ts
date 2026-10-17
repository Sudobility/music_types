/**
 * @sudobility/music_types — types and Zod schemas for the Moosiac music family.
 *
 * Single sectioned entry point (sudojo_types convention):
 *   1. Score model types (spec §4 of the Moosiac spec)
 *   2. Type guards
 *   3. Selection / fragment types
 *   4. Zod schemas for the score tree
 *   5. AI generation contracts (requests, results, provider interface)
 *   6. Zod schemas for the generation contracts
 *   7. Project API types (music_api payloads)
 *   8. Zod schemas for the project API
 *   9. Response envelope + error codes
 *
 * Contains the types and schemas, plus the pure domain primitives both sides
 * of the system need: pitch and tick math, the score factory, quantization,
 * ties and voice allocation.
 *
 * Those primitives used to live in `@sudobility/music_lib`, which put them out
 * of reach of the backend — `music_api` must never depend on `music_lib`, and
 * neither may depend on the other. Anything both sides need lives here or in
 * `@sudobility/music_codecs`; `music_lib` keeps what is frontend-only (store,
 * commands, rendering, playback).
 */

// ---------------------------------------------------------------------------
// The model, its schemas and the API payloads.
//
// These used to be declared inline here, which made this file 1,463 lines and
// the model hard to find in it. They now live in `src/model/` and are
// re-exported, so the package presents exactly the same surface.
// ---------------------------------------------------------------------------
export * from "./model/score";
export * from "./model/schemas";
export * from "./model/generation";
export * from "./model/api";
export * from "./model/live";
export * from "./model/position";
export * from "./model/selection-source";

// ---------------------------------------------------------------------------
// 10. Score file-format models (codecs live in @sudobility/music_codecs)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Playhead — the one stateful service here; see position/music-position.ts
// ---------------------------------------------------------------------------
export * from "./position/index";
export * from "./bytes/index";

export * from "./formats/index";

// ---------------------------------------------------------------------------
// 11. Platform interfaces (implementations live in @sudobility/music_io)
// ---------------------------------------------------------------------------
export * from "./platform/index";

// ---------------------------------------------------------------------------
// 10. Pure domain primitives (shared by frontend and backend)
// ---------------------------------------------------------------------------

export * from "./domain/pitch/pitch";
export * from "./domain/pitch/transpose";
export * from "./domain/quantization/options";
export * from "./domain/quantization/quantize";
export * from "./domain/score/defaults";
export * from "./domain/score/transport-state";
export * from "./domain/score/factory";
export * from "./domain/score/fragment";
export * from "./domain/score/ids";
export * from "./domain/score/queries";
export * from "./domain/score/ties";
export * from "./domain/selection/types";
export * from "./domain/time/durations";
export * from "./domain/time/fraction";
export * from "./domain/time/tempo-map";
export * from "./domain/time/ticks";
export * from "./domain/voicing/allocate";
export * from "./domain/validation/issues";
export * from "./domain/validation/validator";
export * from "./domain/validation/limits";
export * from "./domain/validation/repair";

// ---------------------------------------------------------------------------
// 11. Score commands (pure Score -> Score transformations, shared by both sides)
// ---------------------------------------------------------------------------

export * from "./domain/commands/types";
export * from "./domain/commands/reflow";
export * from "./domain/commands/snapshot";
export * from "./domain/commands/structure-commands";
export * from "./domain/commands/clipboard-commands";
export * from "./domain/commands/track-commands";
export * from "./domain/commands/region-commands";
export * from "./domain/commands/note-commands";
export * from "./domain/commands/note-marks";
export * from "./domain/commands/repair-commands";
export * from "./domain/commands/edit-commands";
export * from "./domain/commands/relocate-commands";
export * from "./domain/commands/ripple-commands";
export * from "./domain/instruments/gm";
export * from "./domain/instruments/gm-catalogue";
export * from "./domain/instruments/arrangement-order";
export * from "./domain/instruments/midi-protocol";
export * from "./domain/instruments/gm-kit";
export * from "./domain/instruments/gm-range";
export * from "./domain/instruments/range-fit";
export * from "./domain/instruments/gm-polyphony";
export * from "./domain/instruments/gm-transposition";
export * from "./domain/instruments/gm-percussion";
export * from "./domain/generation/style-presets";
export * from "./domain/generation/option-order";
export * from "./domain/generation/style-families";
export * from "./domain/documents/project-file";
export * from "./domain/generation/score-presets";
export * from "./domain/selection/selection";
export * from "./services/regeneration/controller";

// Absorbed from music_lib: pure, synchronous, dependency-free model code
// that both the app and the server need.
export * from "./domain/commands/history";
export * from "./domain/generation/replacement-region";
export * from "./domain/generation/live-generation";
export * from "./domain/generation/project-origin";
export * from "./domain/instruments/gm-icon";
export * from "./domain/instruments/gm-spatial-model";
export * from "./domain/instruments/icon-art";
export * from "./domain/instruments/instrument-fit";
export * from "./domain/instruments/instrument-options";
export * from "./domain/instruments/spatial-art";
export * from "./domain/instruments/track-instrument";
export * from "./domain/unplugged/unplugged";
export * from "./domain/notation/chord-symbol";
export * from "./domain/notation/lyric-syllables";
export * from "./domain/lyrics/syllabify";
export * from "./domain/lyrics/lyric-fit";
export * from "./domain/lyrics/distribute-syllables";
export * from "./domain/lyrics/align-lyrics";
export * from "./domain/notation/music-vocabulary";
export * from "./domain/notation/picker-options";
export * from "./domain/notation/field-values";
export * from "./domain/notation/toolbar-icons";
export * from "./domain/score/transport-readouts";
export * from "./domain/instruments/instrument-menus";
export * from "./domain/instruments/instrument-reference";
export * from "./domain/score/articulation";
export * from "./domain/score/bar-numbers";
export * from "./domain/score/collapse-rests";
export * from "./domain/score/common-value";
export * from "./domain/score/community-search";
export * from "./domain/score/cue-notes";
export * from "./domain/score/dynamics";
export * from "./domain/score/effective-clef";
export * from "./domain/score/extract-part";
export * from "./domain/score/fermata-tempo";
export * from "./domain/score/flatten";
export * from "./domain/score/ottava";
export * from "./domain/score/display-score";
export * from "./domain/score/performance-timeline";
export * from "./domain/score/rehearsal-marks";
export * from "./domain/score/repeat-order";
export * from "./domain/score/snapshot-tree";
export * from "./domain/score/written-pitch";
export * from "./domain/selection/range-select";
export * from "./domain/selection/selection-editing";
export * from "./domain/selection/clipboard-prompts";
export * from "./domain/notation/display-lens";
export * from "./domain/time/duration-modifiers";
export * from "./domain/time/duration-selection";
export * from "./domain/time/tap-to-note";
export * from "./domain/time/beams";
export * from "./domain/time/tuplets";
/**
 * The notation glyphs as data, shared by the web and native toolbars.
 * Generated; see the module header.
 */
export * from "./domain/notation/notation-icon-art";

// ---------------------------------------------------------------------------
// Frontend vocabulary: the closed lists, option tables and shapes both apps
// and the frontend libraries name. Types and data only — the rules over them
// live in music_editing, music_drawing and music_lib, which import them from
// here rather than declaring a second copy.
// ---------------------------------------------------------------------------
export * from "./domain/instruments/out-of-range";
export * from "./domain/documents/document-state";
export * from "./domain/documents/export-formats";
export * from "./domain/documents/formats";
export * from "./domain/documents/publish";
export * from "./domain/documents/templates";
export * from "./domain/generation/request-drafts";
export * from "./domain/generation/replace-drafts";
export * from "./domain/score/transport-settings";
export * from "./domain/editor/app-errors";
export * from "./domain/editor/context-menu";
export * from "./domain/editor/device-prefs";
export * from "./domain/editor/docs";
export * from "./domain/editor/edit-mode";
export * from "./domain/editor/editing-copy";
export * from "./domain/editor/inspector";
export * from "./domain/editor/labelled-option";
export * from "./domain/editor/library-copy";
export * from "./domain/editor/print";
export * from "./domain/editor/score-input";
export * from "./domain/editor/toast";
export * from "./domain/editor/toolbar";
export * from "./domain/editor/view-settings";
