# @sudobility/music_types

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

The model of the Moosiac music family, and every name the family shares: the score types and their Zod schemas, the pure primitives both the frontend and the backend need (pitch and tick math, factories, commands, instrument knowledge, readout formatting, `outOfRangeNoteIds`), and **every shared type and closed vocabulary** — the codecs' option and result types, the platform contracts, the editor's vocabulary, the generation drafts, the export formats and the formats table. Consumed by music_api, music_codecs, music_player, music_drawing, music_editing, music_client, music_io, music_lib and both apps.

**Two rules decide what lives here, and both are the user's.** *All type definitions and vocabulary constants live in music_types* — a shape or a closed list another package names is declared here once, never in the package that happens to use it first. *Pure helper functions used by both the frontend and the backend live in music_types* too. Either kind must still pass the four tests every module here passes: it works on both sides, adds no dependency (the runtime dependencies are `zod` and `immer`, and that is the whole list), contains no hook, and contains no async code. A type whose shape needs zustand, React, a class or a renderer stays with the package that has that dependency.

## Tech Stack

- TypeScript (strict), ESM only. Source imports are extensionless (`entity_pages`' convention, not the `.js`-suffixed one most of the rest of this family uses — see that family's own CLAUDE.md). `tsc` (plain `tsconfig.json`, `noEmit: true`) is the type-check gate; `vite build` (`vite-plugin-dts` for declarations) is what actually emits `dist/` — one bundled `dist/index.js`, plus `dist/test/fixtures.js` as its own entry since `@sudobility/music_types/test` is a real, separately-imported subpath across the family
- Zod v4 schemas (runtime dependency — schemas are exported values)
- Bun for scripts, vitest for tests
- Published to npm as `@sudobility/music_types` (public access) via CI on push to main

## Commands

- `bun install` — install dependencies
- `bun run verify` — typecheck + lint + test + build (run before any push)
- `bun run test` — vitest (tests co-located in `src/*.test.ts`)
- `bun run build` — emit `dist/`

## Structure

Everything exports from a single sectioned `src/index.ts`:

1. Score model types (Score/Track/Measure/Voice/NoteEvent/RestEvent, DurationName, Clef, …)
2. Type guards (`isNoteEvent`, `isRestEvent`)
3. Selection/fragment types (`ScoreRange`, `ScoreSelection`, `ScoreFragment`)
4. Zod schemas for the score tree (`scoreSchema`, `parseScore`, …)
5. AI generation contracts (`GenerateScoreRequest` → `GenerateScoreResult`, `RegenerateRegionRequest` → `RegenerateRegionResult`, `MusicGenerationProvider`)
6. Zod schemas for the generation contracts (`parseGenerateScoreRequest`, …)
7. Project API types (`ProjectRecord`, `ProjectSummary`, `ProjectCreateRequest`, `ProjectUpdateRequest`, `ProjectListQuery`)
8. Zod schemas for the project API
9. Response envelope (`ApiResponse<T>`, `successResponse`, `errorResponse`, `API_ERROR_CODES`)

Then the shared primitives under `src/domain/` (score, commands, instruments, notation, generation, …) and the shared vocabulary:

- `src/formats/` — the codecs' option and result types and the audio-import extensions
- `src/platform/` — the platform contracts (`ScoreFiles`, `PrefsStorage`/`DocumentFileStorage`, `XmlParser`, `FileExporter`, MIDI input, playback — including the `SynthBackend` synth contract in `playback.ts`)
- `src/playback/` — pure playback/voicing helpers shared by `music_player`'s scheduler and the synth packages: `channel-allocator`, `mix` (headroom trim + export limiter), `instrument-gain`
- `src/domain/editor/` — the editor's vocabulary (edit modes, device prefs, toasts, `LAYOUT_MODES`/`LayoutMode`, `PAPER_OPTIONS`/`ORIENTATION_OPTIONS`, docs, inspector, toolbar and context-menu vocabularies, input shapes, copy contracts)
- `src/domain/documents/` — `export-formats.ts` (`WRITABLE_EXPORT_FORMATS`), `formats.ts` (`IMPORT_FORMATS`/`EXPORT_FORMATS`), `templates.ts`, `document-state.ts`, `publish.ts`, and `project-file.ts` (`DOCUMENT_EXTENSION(S)`, `PROJECT_FILE_VERSION`, `ProjectFile`; the parser and serializer are music_codecs')
- `src/domain/generation/request-drafts.ts` / `replace-drafts.ts` — the generation forms; `src/domain/score/transport-settings.ts` — `TransportSettings`/`PlayerFailure`

`src/test-helpers.ts` is a test-only fixture helper (excluded from the published build); shared score factories live in this package under `domain/score/`.

## Gotchas

- **Frontend vocabulary lives here too, as types and data only.** Both apps and every frontend library name the same closed lists and shapes, and music_lib re-exports this package *and* music_editing/music_codecs/music_drawing wholesale — so a shape declared in two of them is a TS2308 in music_lib and a "Cannot redefine property" crash in a CommonJS consumer. `domain/editor/` holds the editor's vocabulary (`EDIT_MODES`/`EDIT_MODE_OPTIONS`, `THEME_MODES`/`FONT_SIZES`/`DevicePrefs`/`DevSettings`, `Toast`/`ToastSink`, `LAYOUT_MODES`, `QUANTIZE_GRIDS`, the inspector, toolbar and context-menu vocabularies, `ClipboardData`, `ScoreCanvasHit` and the other input shapes, `EditingCopy`/`LibraryCopy`, the docs and shortcut shapes, the paper options, `AppErrorCode`); `domain/generation/request-drafts.ts` and `replace-drafts.ts` the generation forms (`NewProjectSubmission`, `LOCKABLE`, `ReplaceSubmission`); `domain/documents/` the export formats (`WRITABLE_EXPORT_FORMATS`) and the formats table (`formats.ts`, which came from music_editing), `TEMPLATE_IDS`, `DocumentOrigin`/`SaveState`, `PublishNames`, and the project file's name and version (`DOCUMENT_EXTENSION(S)`, `PROJECT_FILE_VERSION`); `domain/score/transport-settings.ts` `TransportSettings`/`PlayerFailure`; `formats/` the codecs' option and result types (`MidiImportOptions`, `MusicXmlWarnings`, `TrackerFitReport`) and the audio-import extensions; `platform/` the `ScoreFiles`, `PrefsStorage` and `DocumentFileStorage` contracts. The rules over them live with whatever owns the rule — `selectToolbarAvailability` in music_editing; `bindPlayer`, `planExport`, `decideClose`/`decideQuit`, `resolveThemeMode` and the docs content in music_lib; `litKeys` in music_drawing; the parsers and serializers in music_codecs. This package has no moved-names guard because it is where names move *to*; each package they left carries one (`__moved-to-types.test.ts` in music_codecs, music_client, music_io and music_lib, `__moved-out.test.ts` in music_drawing and music_editing).
- **`outOfRangeNoteIds` is a pure question about the model**, so it lives in `domain/instruments/out-of-range.ts`, beside `trackRangeIsBinding` (`range-fit.ts`), rather than in music_drawing, which only colours the answer. It takes the **stored** score, never `displayScore`'s.
- **A file named `document.ts` trips `platform-free.test.ts`**: the export path `./documents/document.js` reads as the `document.` global to its pattern. That is why it is `document-state.ts`.


- **One row per General MIDI program, and every row says where its numbers came from** (`gm-catalogue.ts`). Range, polyphony and transposition used to be three tables of family defaults plus a handful of per-program overrides — which looked like deduplication and was not: 90 of the 128 programs inherited a compass nobody had chosen for them, and an inherited value was indistinguishable from a researched one. It hid a real bug (**Muted Trumpet** had no transposition entry, so a B-flat trumpet with a mute in the bell was treated as non-transposing and its part displayed a whole tone wrong), gave the **Clavinet** an 88-key piano compass where it has 60 keys F1-E6, and handed the flute's exact range to five instruments that share none of it. The repetition where eight guitars genuinely share a compass is the point: writing it eight times is a decision somebody made, where inheriting it eight times is a question nobody was asked. **`basis` is the field to read before trusting a number** — `measured` (checked against a source), `synthetic` (an electronic patch has no acoustic compass, so it gets the whole keyboard rather than an invented limit), `unpitched` (a sound effect), and `assumed` (**not verified**, carried over from the old default, left deliberately wide). No row is left `assumed`: the 31 that were have each been settled, most by looking the instrument up and ten by finding that the honest answer is `tunable` — a shamisen is tuned to the singer, a koto to the piece, an mbira to notes that are not on the tempered scale at all, and a pan flute or hammered dulcimer is built in many sizes; refusing a note against those would be refusing against the sampler rather than the instrument. Section patches (`String Ensemble`, `Brass Section`) take the **union of the instruments in them, computed rather than typed**, so a string section cannot end up narrower than the cello inside it. Where General MIDI names a family rather than an instrument the row covers the common members: "Recorder" is soprano and alto together, "Bagpipe" is the Highland chanter's nine notes and the uilleann's two octaves together — the Highland compass alone is fifteen semitones and rejected honest music. The split is now 75 measured, 30 synthetic, 13 unpitched, 10 tunable. `gmRangeIsBinding` answers `true` only for `measured`, and the generation inspector consults it before reporting an out-of-range note: refusing a note against a compass nobody checked rejects music that was fine, and since that finding drives a retry it would spend real money arguing about a limit we invented.

- **`Track.midiProgram` means two different things, and
  `domain/instruments/track-instrument.ts` is the only place that knows which.**
  On a percussion-clef track (`isPercussionTrack`) it addresses a General MIDI
  *drum kit* (`gm-kit.ts`); everywhere else it is an instrument (`gm.ts`). The two
  never coincide — Brush is kit 40, and program 40 is Violin — so every
  program-keyed table (`gm-range`, `gm-polyphony`, `gm-transposition`,
  `gm-icon`) gives a confidently wrong answer for a drum track. Take a `Track`
  and call `trackKeyboardRange`/`trackMaxPolyphony`/`trackWrittenTransposition`/
  `trackInstrumentIcon`/`trackInstrumentLabel` instead; the program-keyed
  functions stay exported for callers that genuinely hold only a program.
  `scoreWithResolvedKits` (which music_editing's `setScore` runs inbound) snaps a
  percussion track to a real kit and returns the **identical score** when there
  is nothing to fix, which is what keeps opening a project from marking it dirty.

- **A regeneration request says who is playing, and a kit gets told how a kit is written.** A `ScoreFragment` is measures and nothing else — no name, no clef, no program — so "Replace Track" used to hand the model anonymous bars and let it infer the instrument from the notes in front of it. On a drum track there is nothing to infer from: the pitches are drum numbers, not notes. Measured on a real Power Kit regeneration, the result was the kick on every eighth of all 118 bars at a constant velocity 100, the snare on all four beats instead of the backbeat, and five of the 47 drums used — a metronome, not a groove. `RegenerateRegionRequest.tracks` now carries a `GenerateScoreRequestTrack` per fragment track, built by `describeTrackForGeneration` in music_types so whole-score generation and regeneration describe a track the *same* way; the range and polyphony come from `trackKeyboardRange`/`trackMaxPolyphony`, which answer about the **kit** on a percussion track rather than about whatever melodic program shares its number. The roster is matched to the fragment **by position**, so `buildRegeneratePrompt` emits it only when the lengths agree — a roster of a different length is not partial information but wrong information, naming the kit as the cello. And `percussionRules()` — previously generate-only, and previously just the GM map — now travels on both paths and states the two Expression rules that **invert** for percussion: an accent is the rule rather than the exception (velocity variation between accented and ghost notes *is* the groove), and a kit does play continuously even though each individual drum still rests. The map alone is not enough, which is the thing that had to be measured to be believed.

- **One fact, one declaration — and each consuming package's `src/__single-source.test.ts` enforces it** (here, `domain/vocabulary-source.test.ts` pins the array-then-type shape). A constant restated in a second package agrees with the first right up until one of them is edited, and nothing fails when they part: the build is clean, the types match, and the only symptom is a wrong sound or a picker quietly missing an entry. Measured across the family, 23 UPPER_CASE constants were declared in more than one repo — `CC_VOLUME` three times, `DYNAMICS` four, `C_MAJOR` five, and `DEFAULT_TIME_SIGNATURE` in four places under two names. The guard reads the list of names **from music_types at runtime** rather than restating it, because a check against duplication that duplicates what it checks would drift like everything else; its `ALLOWED` list is empty on purpose, so an exemption is a decision somebody writes down. Two shapes matter beyond the constants themselves. **A closed vocabulary is declared as an array and the type read off it** (`export const DYNAMICS = [...] as const; export type Dynamic = (typeof DYNAMICS)[number];`) — a TypeScript union has no runtime form, so anything that must *validate* a value has to write the list out again, which is exactly how music_api's decoder came to check generated music against its own private copy. **A label or option list keyed by the vocabulary is a `Record<T, ...>`, never a parallel array** — a record fails to compile when a member is added, an array silently goes on offering the old set; that is why the inspector's picker lists are `ACCIDENTAL_OPTIONS`/`ARTICULATION_OPTIONS` built from the vocabulary rather than `ACCIDENTALS`/`ARTICULATIONS` retyped. Test fixtures follow the same rule: the score fixtures live once, in `@sudobility/music_types/test`, and a package that needs a rendering fixture of its own re-exports them and adds to them.

- **The playhead is the one stateful service in this package, and that is a
  deliberate precedent.** `MusicPosition` and its singleton live in
  `src/position/`. Everything else here is model and primitives; the playhead
  earns the exception because it has exactly one writer
  (`@sudobility/music_player`) and readers in every other package — the caret,
  the note highlighting, the piano keyboard — so any other home creates a
  dependency edge that exists only to reach it. It still obeys the four rules:
  works on both sides, no dependency, no hooks, no async.
- **`base64.ts` is here because its two consumers ended up in different
  packages.** `music_io`'s React Native file exporter encodes; `music_player`'s
  sample-pack loader decodes. The module exists precisely so there is one
  alphabet and one round-trip test rather than a copy each — splitting it would
  break the property it was written to guarantee.
- **The playback *plan* is here; the single-home *engine* contract is not, but
  the multi-home *synth* contract is.** `PlaybackPlan` composes
  `PerformanceTimeline`, which `performanceTimeline()` in `domain/score/`
  produces, so the whole plan cluster is anchored here — moving it would make
  this package import from `music_player`. `PlaybackEngine`, `PlaybackObserver`
  and `AuditionVoice` live in `music_player`, which is the only thing that
  implements or calls them. **`SynthBackend` (with `ScheduledClick` and
  `PrepareResult`), by contrast, lives here** (`platform/playback.ts`): it has
  more than one implementer across packages — `music_synth`'s `WebSynthBackend`
  and `music_synth_rn`'s `NativeSynthBackend` — and `music_player`'s scheduler
  consumes it, so none of the three can own it. Same rule as a `labelKey` or a
  closed vocabulary: a contract with several homes belongs in the base they all
  depend on.
- **Pure playback/voicing helpers live in `src/playback/`** — `channel-allocator`,
  `mix` (headroom trim + the export limiter), `instrument-gain`. They are pure
  and shared by `music_player`'s scheduler and the synth packages (the engine
  and a backend disagreeing on a channel assignment is a silent note loss), so
  they sit beside the `SynthBackend` contract rather than in any one consumer —
  the same "pure helpers both sides use" rule the format tables follow.

- Pure shared domain logic belongs here when both frontend and backend need it:
  tick math, factories, commands, validation, instrument knowledge, generation
  presets and prompt-facing shared data — and every type and vocabulary
  constant, whoever uses it (see the two rules at the top). This package must never depend on
  `music_lib`, and `music_api` must never pull in frontend UI/audio code just
  to reach a shared rule.
- `noteEventSchema`/`restEventSchema` are `.strict()` on purpose (a stray `pitch` key must not pass as a rest); other schemas strip unknown keys for forward compatibility.
- Ticks are integers at 480 PPQ by convention; `startTick` is absolute.
- **A picker's option list belongs beside the vocabulary it is built from**
  (`picker-options.ts`). `ARTICULATION_OPTIONS` existed in music_app's
  inspector, in music_app_rn's toolbar *and* in its Note tab, and the three
  agreed only because nobody had added a fifth articulation yet — a hand-written
  list goes on offering the old set in silence, which is the exact failure the
  `Record<T, …>` rule next to this one exists to prevent. Each list is `map`ped
  off the vocabulary, so a new member reaches every picker in both apps without
  anybody remembering to. Two shapes are load-bearing. They carry an **i18n key,
  never a translated string** — the words belong to the app, and a key is not
  prose but the name of a fact. And "none" travels under the `NO_MARK`
  sentinel, because a picker's value is a string and an empty one is
  indistinguishable from "nothing chosen" (Radix refuses it outright; the native
  `Select` behaves the same). The one thing that stays in each app is a
  **drawing**: the toolbar attaches its own glyph to the shared value, since a
  React component is the one thing a vocabulary cannot carry.

- **`commonValue` is here because a property panel acts on a *selection*.** A
  field that showed the first object's value would say "Staccato" for a
  selection that is mostly not, and setting it would look like a no-op on
  everything that already agreed. It compares by **structure, not identity** —
  pitches, time and key signatures are small objects rebuilt on every read, so
  `===` reports every multi-note selection as mixed. Written once per app before
  this, which is how the two came to disagree about whether an empty selection
  was `null` or mixed.

- **Saying a stored value the way a musician says it belongs here**
  (`music-vocabulary.ts`). A score stores ticks, fifths and zero-based voice
  indexes because those are the right things to compute with, and none of them
  is the right thing to *show* — `Duration 480` and `Key (fifths) 2` state the
  storage format. The conversions are facts about music rather than details of
  a panel, and there are now **two** apps drawing the same panels, which is
  what settles where they live: a display conversion transcribed into the
  native app agrees with the web's copy right up until one of them is edited,
  and nothing fails when they part. `panReadout` arrived exactly that way — it
  was three lines in `music_app/src/features/tracks/pan-readout.ts` and three
  identical lines in music_app_rn the moment the native property sheet gained a
  pan row. A conversion qualifies for this file under the same four rules as
  anything else here: it works on both sides, adds no dependency, has no hook
  and no async in it. No user-facing prose, though — note values and key names
  are terms of the domain, fixed across locales the way General MIDI's
  instrument names are, but anything a translator would touch is the app's.

- **A guard test enforces that this package runs on React Native** (`src/platform-free.test.ts`): no web-only global and no `import.meta`. This matters more here than anywhere else — these are the platform *interfaces* every other repo implements, so one DOM type in a signature spreads to all of them. That is why `FileExporter.save` takes `Uint8Array | string` rather than a `Blob`, and the codecs take `ArrayBuffer`. `tsconfig.json` still sets `lib: [..., "DOM"]` (for `AbortSignal`) and `eslint.config.js` still spreads `globals.browser`, so nothing else would object.

- **A singer is a picker group, not a hunt through Ensemble.** General MIDI files the three voice programs (52 Choir Aahs, 53 Voice Oohs, 54 Synth Voice) under *ensemble*, between String Ensemble and Orchestra Hit — so in practice no generated score ever had one in it, while the backend carries several hundred lines of lyric and vocal-support rules for a part nobody could ask for. `VOICE_OPTIONS` lifts them into a group of their own at the top of the generation pickers, **derived from `VOICE_PROGRAMS`** in `arrangement-order.ts` rather than restating three numbers: a picker offering a voice the arranger does not recognise as one is exactly the drift that costs a vocal-led arrangement. They leave `FAMILY_GROUPS` in the same move, because a program in two groups of one menu is a selection the control cannot show unambiguously — but `INSTRUMENT_OPTIONS` keeps all 128, since that one is the catalogue and not a menu. `isVocalInstrumentValue` answers on the picker *value*, so `kit:52` is a drum kit rather than a choir.
- **The singer is written first, ahead of the genre order.** In `rankTracksForGeneration`, `voiceFirst` used to be a tiebreak among equally ranked parts, so it only did anything where `lead` already came first. `GROOVE_FIRST` writes the lead **last** — in reggae the bassline is the material and the melody decorates it, which is true of an instrumental and inverts the moment somebody is singing over it — so in eleven genres every backing part was composed before the voice existed, `vocalSupportRule` in music_api had no singer to point at, and the vocal was bent to fit a finished arrangement instead of the other way round. It is now the primary sort key, and `roleOrderForStyle` is untouched, so a roster with no voice is arranged exactly as it was. A percussion track is never promoted, whatever its program addresses: on the drum channel, program 53 is a kit.
- **A closed vocabulary is offered in the order it is read, not the order it was declared.** `sortOptionsByLabel` sorts on the **translated** label under the active language. Both halves matter: the value is `electroSwing` while the reader sees "Electro Swing", so sorting the keys puts entries wherever their camel-case identifier happens to fall; and collating Chinese labels by the English they were translated from produces an order with no visible logic at all. The 33 styles and 6 moods go through it in both apps — an ordering rule written twice is one that eventually disagrees with itself.

- **The preset briefs are the server's list and the hosts' words.** `SCORE_PRESET_KEYS` is the closed vocabulary; which of them suit which genre lives in `music_api` and is served by `GET /public/presets?style=`, so it can be retuned without shipping an app and two apps cannot offer different starting points for the same style. The *text* stays in each app's locale files, because the brief a reader picks is also the prompt sent to the model and a Chinese reader should be prompting in Chinese — the same division `MusicXmlWarnings` uses. The vocabulary is here rather than only on the server because **both ends need it**: the server must not serve a brief no app can name, and each app must be able to prove offline, in a test, that it has words for every brief it could be sent. A list only the server had would make the second impossible, which is exactly how a menu comes to print `openingTitle` at a reader. A brief names a subject and a shape and never a genre, since `style` already travels as its own expanded phrase — which is what lets one brief serve several genres instead of 33 sets of bespoke copy.
- **`weak` is gone and `default` is called "Open AI".** The label said only that it was the default, which is a fact about the picker rather than about which company's model writes the music. The wire value is still `default`, and the default is still expressed by sending **no field at all**, so an ordinary request is byte-for-byte what it was.

- **The lyric's subject is its own field, and it replaces rather than adds.** `lyricsTheme` was once deliberately absent, on the grounds that `prompt` already says what the piece is and a second subject line is a place for the two to disagree. What that missed is that they are different questions: "a slow waltz in D minor" describes the music, and the words over it can be about coming home. The disagreement is avoided by there being exactly **one** "the words are about" clause on the server, which this fills when present and `prompt` fills otherwise — so a request that says nothing about it produces the lyric it always did, and `prompt` still reaches the model in its own right. Never sent without `lyrics`: `buildGenerateScoreRequest` drops both on the same rule.

## Related Projects

- `music_api` — backend (Hono/Drizzle/OpenAI proxy), consumes schemas for validation
- `music_client` — typed network client + React Query hooks
- `music_lib` — frontend app logic, adapters, store
- `music_app` — web app (UI/routing only)

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.
