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
