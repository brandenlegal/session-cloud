/**
 * WaveSurfer mounts into this element (ref from useAudioPlayer / player transport).
 */
export function Waveform({ setContainer, className = "" }) {
  return (
    <div
      ref={setContainer}
      className={`min-h-[80px] w-full rounded-lg border border-cyan-500/25 bg-[oklch(0.14_0.045_260/0.85)] ${className}`}
    />
  );
}
