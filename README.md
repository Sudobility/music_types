# @sudobility/music_types

Shared TypeScript types and Zod schemas for the Moosiac music platform: the score data model, AI generation contracts, project API payloads, and the standard API response envelope.

A platform-free package (no React, no DOM, no async) — it runs identically in the
browser, Node and React Native. Runtime dependencies are exactly `zod` and `immer`.

## Installation

Published to GitHub Packages under the `@sudobility` scope, so consumers need an
`.npmrc` pointing that scope at the registry:

```
@sudobility:registry=https://npm.pkg.github.com
```

```bash
bun add @sudobility/music_types
```

Peer dependencies: `zod` (v4), `immer` (v10/v11), `@sudobility/types`.

## Usage

```ts
import {
  type Score,
  parseScore,
  type GenerateScoreRequest,
  successResponse,
} from '@sudobility/music_types';

const score: Score = parseScore(untrustedJson); // throws ZodError on invalid input
```

Test fixtures are a separate entry point for the rest of the family:

```ts
import { /* score fixtures */ } from '@sudobility/music_types/test';
```

## API Summary

- **Score model** — `Score`, `Track`, `Measure`, `Voice`, `NoteEvent`, `RestEvent`, guards `isNoteEvent`/`isRestEvent`
- **Selection/fragments** — `ScoreRange`, `ScoreSelection`, `ScoreFragment`
- **Zod schemas** — `scoreSchema` tree + `parseScore`
- **Generation contracts** — `GenerateScoreRequest`/`GenerateScoreResult`, `RegenerateRegionRequest`/`RegenerateRegionResult`, `MusicGenerationProvider`, with schemas and `parse*` helpers
- **Project API** — `ProjectRecord`, `ProjectSummary`, create/update/list-query types + schemas
- **Envelope** — `ApiResponse<T>`, `successResponse`, `errorResponse`, `API_ERROR_CODES`
- **Pure domain primitives** (shared by frontend and backend) — pitch & tick math,
  score factory/queries/commands, quantization, ties, voice allocation, instrument
  (General MIDI) knowledge, validation, and the closed vocabularies/option tables.
  See `src/index.ts` for the full exported surface and `CLAUDE.md` for the architecture.

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit (type-check gate)
bun run lint        # eslint src
bun run test:unit   # vitest run  (bun run test:watch to watch)
bun run build       # emit dist/ via vite (+ fix-esm-imports)
bun run verify      # all of the above, in order — run before any push
```

There is no `bun run test`; use `bun run test:unit`. The build is bundled by Vite
(not `tsc`, which only type-checks); `fix-esm-imports` then makes the emitted
specifiers resolvable by Node's native ESM loader.

## License

BUSL-1.1
