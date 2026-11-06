/**
 * Pure playback/voicing helpers shared by the scheduler and every synth.
 *
 * `@sudobility/music_player`'s engine and the synth packages
 * (`@sudobility/music_synth`, `music_synth_rn`) all allocate channels, apply
 * the same per-instrument gain and trim the same headroom. That maths is pure
 * and must agree across all of them — the engine and a backend disagreeing on
 * a channel assignment is a silent note loss — so it lives here in the base
 * they all depend on rather than in any one of them. It sits beside the
 * `SynthBackend` contract in `platform/playback.ts`, which is the interface
 * these helpers are used to satisfy.
 */
export * from "./channel-allocator";
export * from "./mix";
export * from "./instrument-gain";
