// LivePlayer — thin wrapper around @remotion/player <Player>.
//
//   <LivePlayer compositionId="KineticType" inputProps={{ slides: [...] }} />
//
// Sizing: the Player scales to fit its container's width while preserving
// the composition's native aspect ratio. Audio/Video tracks autoplay muted
// by default — pass `mutedDefault={false}` to allow sound.
//
// If the composition isn't found in the registry, renders a neutral
// placeholder rather than crashing the page.

import { Player } from "@remotion/player";
import { useMemo } from "react";
import { getComposition } from "./composition-registry";

interface LivePlayerProps {
  compositionId: string;
  inputProps?: Record<string, unknown>;
  /** Override: if you only want a single slide segment, pass [start, end] in frames. */
  range?: [number, number];
  /** Show controls bar. Defaults true. */
  controls?: boolean;
  /** Loop continuously. Defaults true. */
  loop?: boolean;
  /** Autoplay on mount. Defaults true (muted). */
  autoPlay?: boolean;
  /** When true, audio starts muted (avoids browser block + politeness). */
  mutedDefault?: boolean;
  /**
   * Frame to render when paused / on first mount. Defaults to a frame past
   * each composition's entry animation so cards show their full design even
   * before playback starts. Override per-Player if you want frame 0.
   */
  initialFrame?: number;
  /** Extra class on the wrapper. */
  className?: string;
  /** Border radius shorthand. */
  rounded?: string;
}

// Default landing frame past each composition's entry spring (≈ 1s @ 30fps).
// Players paused at frame 0 render an empty AbsoluteFill because every
// slide enters with a spring/opacity 0; landing at 30 shows the design.
const DEFAULT_INITIAL_FRAME = 30;

export function LivePlayer({
  compositionId,
  inputProps = {},
  range,
  controls = true,
  loop = true,
  autoPlay = true,
  mutedDefault = true,
  initialFrame,
  className = "",
  rounded = "rounded-2xl",
}: LivePlayerProps) {
  const entry = getComposition(compositionId);

  // Merge user props with the composition's defaults so missing fields
  // (typical for a half-edited storyboard draft) still play cleanly.
  const merged = useMemo<Record<string, unknown>>(() => {
    if (!entry) return {};
    return { ...entry.defaults, ...stripUndefined(inputProps) };
  }, [entry, inputProps]);

  if (!entry) {
    return (
      <div className={`${className} ${rounded} aspect-[9/16] flex items-center justify-center bg-zinc-900 border border-zinc-800 text-xs text-zinc-500`}>
        Composition <code className="text-zinc-300 mx-1">{compositionId}</code> not found
      </div>
    );
  }

  const fullDuration = entry.durationFromProps(merged);
  // Player rejects ≤0 frames. Stills (ThreadsCard) report 1, which is fine.
  const total = Math.max(1, fullDuration);
  const startFrame = initialFrame ?? Math.min(DEFAULT_INITIAL_FRAME, total - 1);

  return (
    <div
      className={`${className} ${rounded} overflow-hidden bg-black border border-zinc-800`}
      // Fill the parent. Without explicit height the wrapper collapses to 0px
      // and the Player computes 0×0 (audio still mounts, but no visuals).
      style={{ width: "100%", height: "100%" }}
    >
      <Player
        component={entry.Component}
        inputProps={merged}
        durationInFrames={range ? Math.max(1, range[1] - range[0]) : total}
        compositionWidth={entry.width}
        compositionHeight={entry.height}
        fps={entry.fps}
        controls={controls}
        loop={loop}
        autoPlay={autoPlay}
        initialFrame={startFrame}
        // Always mute by default — autoplay with audio is blocked by Chromium
        // anyway, and unsolicited audio in an editor is hostile UX.
        initiallyMuted={mutedDefault}
        // The Player scales to its container. We make the container responsive
        // via aspect-ratio in the wrapper above.
        style={{ width: "100%", height: "100%" }}
        // Remotion supports `inFrame` to start playback later in the timeline.
        inFrame={range?.[0]}
        outFrame={range?.[1]}
        clickToPlay
        spaceKeyToPlayOrPause
        acknowledgeRemotionLicense
      />
    </div>
  );
}

// Player merges shallow; if a user-supplied prop is `undefined` it would
// overwrite a perfectly good default. Strip them so defaults win.
function stripUndefined(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
