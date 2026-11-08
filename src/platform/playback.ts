/**
 * Playback engine contract.
 *
 * Lives here rather than in music_lib because the implementations live in
 * music_io and both sides need the type without either depending on the other.
 * The concrete engines (Tone on web, react-native-audio-api on RN) are the only
 * things that import an audio library; everything that depends on playback
 * depends on this file instead, so the engine stays swappable and mockable.
 */
import type { RenderTrack } from "./audio";
import type { Score, ScoreRange } from "../model/score";

export type TransportPlaybackState = "stopped" | "playing" | "paused";

/**
 * Callbacks the engine invokes as playback advances. `onPositionTick` fires at
 * roughly 30Hz while playing; `onActiveNotes` fires whenever the set of
 * currently-sounding note ids changes; `onStateChange` fires on every
 * play/pause/stop transition, including ones the engine itself initiates.
 */
export type SoundingNote = {
  /** The `NoteEvent.id` this voice came from, for notation highlighting. */
  noteId: string;
  /** Which track it is on, so a consumer can filter without searching the score. */
  trackId: string;
  /** Its sounding MIDI pitch, so a keyboard can light a key without resolving the event. */
  midi: number;
};

/**
 * The engine's readiness to play, for a progress indicator.
 *
 * `fraction` is null while the work has no measurable progress — the synth
 * digesting a soundfont reports nothing until it is done — so a caller can tell
 * a real percentage from "busy, no idea how long".
 */
/**
 * Tick <-> second conversion, as playback needs it.
 *
 * An interface rather than a class so music_io can convert without importing
 * music_lib's `TempoMap` — which satisfies this structurally, so music_lib
 * passes the instance it already builds and no conversion code moves or is
 * duplicated.
 */
export interface TempoConversion {
  ticksToSeconds(tick: number): number;
  secondsToTicks(seconds: number): number;
}

/**
 * A track as playback needs it: the offline render's track plus the two mix
 * flags a live mix can change without reloading, plus the resolved GM voice.
 *
 * The resolved GM voice lives on `RenderTrack` itself, since the offline
 * renderer needs it for exactly the same reason.
 */
export type PlaybackTrack = RenderTrack & {
  muted: boolean;
  solo: boolean;
};

/** One playback-ready note, in score ticks, carrying the ids playback reports back. */
export type PlaybackNote = {
  tick: number;
  durTicks: number;
  midi: number;
  velocity: number;
  trackId: string;
  noteId: string;
};

/** One metronome click. `accent` marks beat 1 of its measure. */
export type MetronomeClick = { tick: number; accent: boolean };

/**
 * Everything live playback needs, and nothing about a `Score`.
 *
 * The live counterpart of `RenderPlan`: music_lib decides every musical
 * question — ties joined, pitches resolved, mute and solo, the measure grid's
 * beat positions, the tempo — and the engine only schedules and sounds what it
 * is handed. This is the seam that keeps music_io free of the domain.
 */
/** A stretch of written music, placed at a point in performance time. */
export type TimelineSegment = {
  performanceTick: number;
  sourceTick: number;
  durationTicks: number;
};

/**
 * How performance time maps back onto the written score.
 *
 * A repeat makes the two differ: bar 3 played twice has two performance
 * positions and one written position. Everything that *draws* a position —
 * the caret, the following-scroll, the bar/beat readout — translates through
 * this, so the score stays the canonical written thing and only the plan
 * knows about expansion.
 *
 * A score with no repeats yields one identity segment, which is what keeps
 * every existing behaviour unchanged.
 */
export type PerformanceTimeline = {
  segments: readonly TimelineSegment[];
  durationTicks: number;
};

/**
 * The engine contract — `PlaybackEngine`, `PlaybackObserver` and
 * `AuditionVoice` — lives in `@sudobility/music_player`, which is the only
 * thing that implements it.
 *
 * The *plan* stays here, and must: `PlaybackPlan` composes `PerformanceTimeline`,
 * which `performanceTimeline()` in `domain/score/` produces. Moving it would
 * make this package import from music_player.
 */
export type PlaybackPlan = {
  tracks: readonly PlaybackTrack[];
  notes: readonly PlaybackNote[];
  clicks: readonly MetronomeClick[];
  tempo: TempoConversion;
  /** Written-to-performed mapping; identity when nothing repeats. */
  timeline: PerformanceTimeline;
  /** The last tick any note ends on, in performance time. */
  durationTicks: number;
};

export type PlaybackLoadState =
  | { status: "idle" }
  | { status: "loading"; fraction: number | null }
  | { status: "ready" }
  | { status: "failed"; message: string };

/**
 * A click that has been placed in the future.
 *
 * Abstract because a click is a tuned oscillator on the web and a percussion
 * note natively; the scheduler only ever needs to know when it has finished
 * sounding and how to take it back.
 */
export type ScheduledClick = {
  /** When it has finished sounding, so a caller knows when to forget it. */
  readonly endsAt: number;
  /** Silences it from `atSeconds`, whether or not it has begun. */
  cancel(atSeconds: number): void;
};

/**
 * Whether the backend actually came up.
 *
 * `deferred` is not a failure: a browser starts an `AudioContext` suspended
 * unless it was created inside a user gesture, and a suspended context never
 * runs its `AudioWorklet` — so the font load would hang rather than fail. The
 * scheduler does the cheap part and tries again from the next gesture. A
 * backend with no such rule simply never returns it.
 */
export type PrepareResult = "ready" | "deferred";

/**
 * Everything the soundfont scheduler needs from the thing that makes sound —
 * the seam between `@sudobility/music_player`'s engine and a concrete synth.
 *
 * This is the one playback contract with more than one home, which is why it
 * lives here and not in music_player beside the single-home `PlaybackEngine`.
 * `music_player`'s `SoundfontPlaybackEngine` consumes it; the synth packages
 * implement it — `@sudobility/music_synth`'s `WebSynthBackend` over an
 * `AudioContext` and js-synthesizer, `music_synth_rn`'s `NativeSynthBackend`
 * over a native synth. None of the three depends on either of the others; all
 * three depend only on this type.
 *
 * It is `SynthHostLike` grown up. That interface was already almost
 * platform-free — instances, channels, programs, timestamped notes — but the
 * engine reached around it for four things that are not: it created its own
 * `AudioContext` for a clock, fetched the soundfont itself, handed the host
 * web-only worklet URLs, and synthesized the metronome click with Web Audio
 * oscillators. Each of those is a different answer on a platform with no
 * `AudioContext` at all, and each was the reason a second engine looked
 * necessary. They are all here instead, so the scheduler — the tempo map, the
 * lookahead, the loop, the seek, the governor, the sounding set — exists once
 * and runs unchanged wherever a backend can be built.
 */
export type SynthBackend = {
  /** Starts the browser audio device synchronously from the user's gesture. */
  activateAudio?(): void;
  /**
   * Brings up the device, the synths and the soundfont, reporting progress.
   *
   * The backend owns the font: a browser fetches bytes and hands them to a
   * worklet, while a native synth is given a file URI and reads it itself —
   * copying 23MB through a bridge would cost more than reading it does. The
   * scheduler only forwards what comes back to `PlaybackLoadState`, which is
   * what the "Preparing instruments" readout shows.
   */
  prepare(options: {
    instanceCount: number;
    /** GM programs present in this score, split by melodic and percussion bank. */
    programs?: { melodic: number[]; percussion: number[] };
    onProgress: (state: PlaybackLoadState) => void;
  }): Promise<PrepareResult>;
  /** Updates the score's required GM programs when the score changes. */
  setPrograms?(programs: {
    melodic: number[];
    percussion: number[];
  }): Promise<void>;
  /** Grows the pool. Never shrinks: a sounding note must not lose its synth. */
  ensureInstances(count: number): Promise<void>;

  /**
   * The clock every scheduled time below is measured against.
   *
   * The audio device's own, not a JS timer: those drift against it, and a
   * playhead is exactly what reveals the drift.
   */
  now(): number;
  /**
   * Seconds between a sound being scheduled and it reaching the speaker, or
   * `undefined` where the platform does not report it. `shared/visual-sync.ts`
   * turns it into the offset that makes lit keys match the ear.
   */
  outputLatency(): number | undefined;

  /**
   * A note that starts `delaySeconds` from `now()` and releases itself after
   * `durationSeconds` — the scheduled-playback call.
   *
   * Self-releasing so that a note needs one crossing rather than two: on the
   * web the pair goes to fluidsynth's sequencer on the audio thread, and
   * natively it goes over a bridge, where a separate note-off could arrive
   * late on its own.
   */
  noteAt(
    instance: number,
    channel: number,
    midi: number,
    velocity: number,
    delaySeconds: number,
    durationSeconds: number
  ): void;
  /** Sounds now and holds — auditioning a key, independent of the transport. */
  noteOn(
    instance: number,
    channel: number,
    midi: number,
    velocity: number
  ): void;
  noteOff(instance: number, channel: number, midi: number): void;

  programSelect(instance: number, channel: number, program: number): void;
  /** A percussion channel addresses a drum bank; `kit` is resolved by the caller. */
  setChannelPercussion(instance: number, channel: number, kit?: number): void;
  controlChange(
    instance: number,
    channel: number,
    control: number,
    value: number
  ): void;

  /** Places a click at `atSeconds` on `now()`'s clock. */
  scheduleClick(atSeconds: number, accent: boolean): ScheduledClick;

  allSoundOff(): void;
  /** Interpolation order, lowered under load — see `governor.ts`. */
  setInterpolation(order: number): void;
  setMasterVolume(volume: number): void;
  /** How many tracks are playing, for whatever headroom the backend applies. */
  setTrackCount(count: number): void;
  dispose(): void;
};

export type Unsubscribe = () => void;

/**
 * The high-frequency half of playback as a contract: position (~30Hz while
 * playing), the sounding set (changes on every note boundary), and transport
 * state. A host subscribes to the same bus the engine publishes into without
 * importing the engine — `@sudobility/music_player`'s `PlaybackBus` class is the
 * one implementation.
 *
 * The `on*` + getters are the read side a host binds React to; `publish*` is the
 * write side the engine drives (and that a test fake drives to simulate one).
 */
export interface PlaybackBus {
  onPosition(fn: (scoreTick: number) => void): Unsubscribe;
  onSounding(fn: (notes: readonly SoundingNote[]) => void): Unsubscribe;
  onTransport(fn: (state: TransportPlaybackState) => void): Unsubscribe;
  /** The last values published, so a subscriber joining mid-playback is not blind. */
  readonly positionTick: number;
  readonly sounding: readonly SoundingNote[];
  readonly transport: TransportPlaybackState;
  publishPosition(tick: number): void;
  publishSounding(notes: readonly SoundingNote[]): void;
  publishTransport(state: TransportPlaybackState): void;
}

export const PLAYBACK_READINESS = ["notReady", "preparing", "ready"] as const;
export type PlaybackReadiness = (typeof PLAYBACK_READINESS)[number];

/** The readiness a load state amounts to. */
export function readinessOf(state: PlaybackLoadState): PlaybackReadiness {
  if (state.status === "loading") return "preparing";
  if (state.status === "idle") return "notReady";
  return "ready";
}

/**
 * The transport — the live playback engine's contract.
 *
 * Takes a `Score`, not a plan: `@sudobility/music_player` owns `playbackPlan`,
 * so making the caller build one first would be a two-step dance whose second
 * step is in the engine. The *engine* underneath still takes a `PlaybackPlan`
 * and does no score maths.
 *
 * Deliberately has no caret, and no `togglePlay`, `seekToMeasure`,
 * `previousMeasure`, `nextMeasure` or loop-from-selection. Those read and write
 * the caret or the selection, both of which are editing state; a copy of either
 * here is a second thing that can disagree with the first. They live in
 * music_lib's playback adapter and compose the primitives below.
 *
 * Lives here, beside `SynthBackend` and the other playback contracts, rather
 * than in `@sudobility/music_player`: the UI, music_lib and the apps all name
 * this type without depending on the engine that implements it.
 */
export interface IMusicPlayer {
  /** Activates browser audio synchronously from the user's Play gesture. */
  activateAudio?(): void;

  /** Browser playback only: change the destination of its live AudioContext. */
  setAudioOutputDevice?(deviceId: string): Promise<void>;
  getAudioOutputDeviceId?(): string;

  /**
   * Adopts a score.
   *
   * **While playing, this is a mix change and nothing else** — the note queue is
   * kept. The edit lock is what makes that safe: while the transport runs, the
   * only score change that can reach here is a mix change. A score arriving
   * from outside that path (a generation result, an opened snapshot) must be
   * preceded by `stop()`, or it will be heard as the old score.
   *
   * Rejects on failure rather than swallowing. The host translates: the message
   * a user sees is a localized string, and this package carries no copy.
   */
  load(
    score: Score,
    opts?: { visibleTrackIds?: readonly string[] }
  ): Promise<void>;

  play(): Promise<void>;
  pause(): void;
  stop(): void;

  /** Seeks to a *written* tick; the first performance of it, if repeats make several. */
  seek(scoreTick: number): void;

  setLoop(range: ScoreRange | null): void;
  setTempoMultiplier(multiplier: number): void;
  setMetronome(enabled: boolean): void;
  /**
   * How long the host takes to draw a change of lit notes, in seconds; the lit
   * notes are published that far ahead so they land with the sound. The score
   * canvas measures it and the shared playback binding reports it.
   */
  setSoundingRenderDelay(seconds: number): void;
  setMasterVolume(volume: number): void;

  /** Live, without rebuilding the note queue: mixing is not editing. */
  applyMix(tracks: readonly PlaybackTrack[]): void;

  /** A track sounds only if it is visible *and* not muted. */
  setVisibleTracks(visibleTrackIds: readonly string[]): void;

  /**
   * Sounds a pitch for as long as it is held — auditioning a key while editing.
   *
   * Touches no transport state on purpose: no caret move, no play/pause change,
   * and no appearance in the active-note highlighting that follows the score.
   *
   * `isPercussion` must be passed for a percussion-clef track, or the tap sounds
   * a pitched instrument while the same note plays back as a drum. The program
   * is resolved to a voice here rather than by the caller, because a percussion
   * program addresses a kit and only the engine's tables know which.
   */
  noteOn(midi: number, program: number, isPercussion?: boolean): void;
  noteOff(midi: number): void;

  /**
   * The three high-frequency channels, as one object.
   *
   * Exposed rather than wrapped so a host binds React to the same bus the
   * engine publishes into — two would be two answers to "what is sounding".
   * `positionTick` and `sounding` hang off it for a subscriber joining
   * mid-playback, which is why they are held at all.
   */
  readonly bus: PlaybackBus;

  onPosition(fn: (scoreTick: number) => void): Unsubscribe;
  onSounding(fn: (notes: readonly SoundingNote[]) => void): Unsubscribe;
  onTransport(fn: (state: TransportPlaybackState) => void): Unsubscribe;
  /**
   * Synth load progress. Not one of the bus's three high-frequency channels —
   * it reports per percent and behaves like ordinary React state, so the host
   * puts it in its store. It is here because the host has no other way to hear
   * about it.
   */
  onLoadState(fn: (state: PlaybackLoadState) => void): Unsubscribe;

  /**
   * Whether the engine can sound a note now: `notReady` until something
   * asks it to come up, `preparing` while it does, `ready` after. One value,
   * owned by the engine, so every Play button on every platform shows the same
   * thing — and never a Play the engine cannot honour. `usePlaybackReadiness`
   * (`@sudobility/music_player/react`) reads it and calls `prepare()`.
   *
   * Derived from the load state: `loading` is `preparing`; `ready` is
   * `ready`; `idle` is `notReady`. **`failed` is `ready`**: the engine could
   * not come up, the failure is reported through `onLoadState` for the host
   * to show, and the one thing left to offer is a Play that retries — a
   * spinner that never ends would offer nothing.
   */
  readonly readiness: PlaybackReadiness;

  /**
   * Brings the engine up — the soundfont fetched and the synth built —
   * without a score, so it is done by the time the first Play arrives rather
   * than started by it. Idempotent: while it is under way, or once done, this
   * is a no-op that resolves when it is.
   */
  prepare(): Promise<void>;

  dispose(): void;
}
