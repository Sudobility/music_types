# @sudobility/music_types

> **Git policy — never auto-commit or auto-push.** Leave your work in the working
> tree. Run `git commit`, `git push`, `gh pr create` or `scripts/push_all.sh`
> **only when the user explicitly asks in that turn.** Stay on the current branch;
> do not open feature branches.

The model of the Moosiac family and every name it shares: the score types and
their Zod schemas, the shared primitives both frontend and backend need (pitch
and tick math, factories, commands, instrument knowledge, readout formatting,
`outOfRangeNoteIds`), **every shared type and closed vocabulary** (the codecs'
option/result types, the platform contracts, the editor vocabulary, generation
drafts, export formats), and the platform contracts including `IMusicPlayer` and
`SynthBackend`. Consumed by music_api, music_codecs, music_player, music_drawing,
music_editing, music_client, music_io, music_lib and both apps. Never depends on
music_lib; this is where names move *to*, so it has no moved-names guard (every
package they leave carries one).

**Two placement rules, both the user's.** *All type definitions and vocabulary
constants live here* — a shape or closed list another package names is declared
here once. *Pure helpers used by both frontend and backend live here* too. Either
must pass the four tests every module here passes: works on both sides, adds no
dependency (runtime deps are exactly `zod` + `immer`), no hook, no async. A type
needing zustand, React, a class or a renderer stays with the package that has
that dependency.

## Tech stack / commands

- TypeScript strict, ESM only, **extensionless source imports** (entity_pages'
  convention, not the `.js`-suffixed one most of the family uses). Target holds to
  **ES2020** (the server consumes this): no `.at()`, `??=`, `Object.hasOwn`.
- Zod v4 — schemas are exported runtime values.
- `tsc` (plain `tsconfig.json`, `noEmit`) is the typecheck gate; **`vite build`
  emits `dist/`** (one bundled `dist/index.js`, plus `dist/test/fixtures.js` as a
  separate entry — `@sudobility/music_types/test` is a real subpath across the family).
- `bun run verify` — typecheck + lint + test + build (before any push).
- `bun run test` — vitest (`src/*.test.ts`). `bun run build` — emit `dist/`.

## Structure

Everything exports from a single sectioned `src/index.ts`: score model types,
type guards, selection/fragment types, score Zod schemas, AI generation contracts
+ their schemas, project API types + schemas, the response envelope
(`ApiResponse<T>`, `API_ERROR_CODES`). Then the shared primitives and vocabulary:

- `src/domain/` — score, commands, instruments, notation, generation, validation,
  pitch, time, quantization, voicing, lyrics, selection.
- `src/domain/editor/` — the editor's vocabulary (edit modes, device prefs, toasts,
  `LAYOUT_MODES`, `PAPER/ORIENTATION_OPTIONS`, docs, inspector, toolbar and
  context-menu vocabularies, input shapes, copy contracts).
- `src/domain/documents/` — `export-formats.ts` (`WRITABLE_EXPORT_FORMATS`),
  `formats.ts`, `templates.ts`, `document-state.ts`, `publish.ts`, `project-file.ts`
  (`DOCUMENT_EXTENSION(S)`, `PROJECT_FILE_VERSION`, `ProjectFile` — parser/serializer
  are music_codecs').
- `src/domain/generation/` — `request-drafts.ts` / `replace-drafts.ts` (the forms).
- `src/formats/` — codecs' option/result types + audio-import extensions.
- `src/platform/` — the platform contracts (`ScoreFiles`, `PrefsStorage`/
  `DocumentFileStorage`, `XmlParser`, `FileExporter`, MIDI input; `SynthBackend` is
  in `playback.ts`).
- `src/playback/` — pure playback/voicing helpers (`channel-allocator`, `mix`,
  `instrument-gain`) shared by music_player's scheduler and the synth packages.
- `src/position/` — `MusicPosition` + its singleton.
- `src/test-helpers.ts` — test-only (excluded from the build); score factories live
  under `domain/score/`.

## Gotchas

- **Vocabulary lives here as types and data only.** music_lib re-exports this
  package *and* music_editing/music_codecs/music_drawing wholesale, so a shape
  declared in two of them is a TS2308 in music_lib and a "Cannot redefine property"
  crash in a CJS consumer. The *rules* over a vocabulary live with whatever owns the
  rule (`selectToolbarAvailability` → music_editing; `bindPlayer`/`planExport`/
  `decideClose` → music_lib; `litKeys` → music_drawing; parsers/serializers → music_codecs).
- **One fact, one declaration** (`domain/vocabulary-source.test.ts`). A closed
  vocabulary is an array with the type read off it (`export const DYNAMICS = [...] as
  const; type Dynamic = (typeof DYNAMICS)[number]`) — a union has no runtime form, so
  anything validating a value needs the list. A label/option list keyed by it is a
  `Record<T, …>`, never a parallel array, so a new member fails to compile rather than
  silently offering the old set.
- **One GM row per program** (`gm-catalogue.ts`), each with a `basis` — `measured`,
  `synthetic`, `unpitched`, `tunable`, `assumed`. `gmRangeIsBinding` is true only for
  `measured`; refusing a note against an unchecked compass rejects fine music and,
  since that finding drives a paid retry, argues about an invented limit. Section
  patches take the computed union of their members.
- **`Track.midiProgram` means two things**, and `domain/instruments/track-instrument.ts`
  is the only place that knows which: a *kit* (`gm-kit.ts`) on a percussion-clef track
  (`isPercussionTrack`), an instrument (`gm.ts`) elsewhere — Brush is kit 40, program 40
  is Violin. Take a `Track` and call `trackKeyboardRange`/`trackMaxPolyphony`/
  `trackWrittenTransposition`/`trackInstrumentIcon`/`trackInstrumentLabel`, not the
  program-keyed functions. `scoreWithResolvedKits` returns the identical score when
  there is nothing to fix (so opening a project does not mark it dirty).
- **`outOfRangeNoteIds` is a pure question about the model** (`domain/instruments/
  out-of-range.ts`), so it lives here, not in music_drawing which only colours the
  answer. Takes the **stored** score, never `displayScore`'s.
- **`MusicPosition` is the one stateful service here** (`src/position/`), a deliberate
  exception: one writer (music_player), readers everywhere (caret, highlighting, piano
  keyboard). It still obeys the four rules.
- **The playback *plan* is here; the engine contract is not; the synth contract is.**
  `PlaybackPlan`/`PerformanceTimeline` anchor here (moving them would import from
  music_player). `PlaybackEngine`/`PlaybackObserver`/`AuditionVoice` live in music_player
  (single home). `SynthBackend` (+ `ScheduledClick`, `PrepareResult`) lives here in
  `platform/playback.ts` because it has several implementers (music_synth, music_synth_rn)
  and the scheduler consumes it — a multi-home contract belongs in the shared base.
- **`base64.ts` is here because its two consumers are in different packages** (music_io
  encodes, music_player decodes) — one alphabet, one round-trip test.
- **Schema strictness:** `noteEventSchema`/`restEventSchema` are `.strict()` (a stray
  `pitch` key must not pass as a rest); other schemas strip unknown keys for forward
  compatibility. Ticks are integers at 480 PPQ; `startTick` is absolute.
- **`commonValue` compares by structure, not identity**, because a property panel acts
  on a selection and pitches/signatures are small objects rebuilt per read (`===` reports
  every multi-note selection as mixed).
- **`platform-free.test.ts` enforces React Native compatibility:** no web-only global,
  no `import.meta` — these are the interfaces every repo implements, so one DOM type in
  a signature spreads everywhere. Hence `FileExporter.save` takes `Uint8Array | string`
  not `Blob`, and codecs take `ArrayBuffer`. A file named `document.ts` trips the guard
  (the export path reads as the `document.` global), which is why it is `document-state.ts`.
- **Generation describes a track one way** (`describeTrackForGeneration`) for both
  whole-score and regeneration, so range/polyphony answer about the *kit* on a percussion
  track. `VOICE_OPTIONS` (derived from `VOICE_PROGRAMS`) lifts singers out of GM's Ensemble
  group; `isVocalInstrumentValue` answers on the picker value (`kit:52` is a kit). Pickers
  carry an i18n **key**, never translated prose; "none" travels as the `NO_MARK` sentinel.
- **Option lists sort on the translated label** (`sortOptionsByLabel`) under the active
  language. `SCORE_PRESET_KEYS` is the preset vocabulary (text in each app's locales,
  genre mapping in music_api served by `GET /public/presets`); the vocabulary is here so
  each app can prove offline it has words for every brief the server could send.

## Related projects

`music_api` (backend, consumes schemas) · `music_client` · `music_lib` · `music_app`
· music_codecs · music_player · music_drawing · music_editing · music_io
