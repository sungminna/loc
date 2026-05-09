// Shared background-image renderer.
//
// Per the redesign brief: a generated bg image is *scenery*. It does not
// move, does not zoom, does not crop differently per slide. Each template
// owns one ImageFrame (in layout.ts) and this component renders the image
// inside that frame in the template's "mode" (full / tile / torn / inset /
// specimen). Compositions don't touch the image themselves — they pass
// the URL down and the frame is the entire contract.

import { Img } from "remotion";
import type { ImageFrame } from "../layout";

interface Props {
  url?: string;
  frame: ImageFrame;
  /** Background fill behind the image when missing (template surface color). */
  surface: string;
  /** Border / frame color for tile/specimen modes. */
  rule?: string;
  /** Optional gradient/scrim overlay drawn ON TOP of the image (Aurora). */
  scrim?: string;
}

export const BgImage: React.FC<Props> = ({ url, frame, surface, rule, scrim }) => {
  if (!url) return null;
  const { mode, top, left, width, height, rotate = 0, radius = 0 } = frame;

  if (mode === "full") {
    return (
      <>
        <Img
          src={url}
          style={{
            position: "absolute",
            top, left, width, height,
            objectFit: "cover",
          }}
        />
        {scrim ? (
          <div style={{
            position: "absolute", top, left, width, height,
            background: scrim,
            pointerEvents: "none",
          }} />
        ) : null}
      </>
    );
  }

  if (mode === "tile") {
    return (
      <div style={{
        position: "absolute",
        top, left, width, height,
        transform: `rotate(${rotate}deg)`,
        borderRadius: radius,
        background: surface,
        boxShadow: "16px 16px 0 0 rgba(26,18,38,0.92), 0 36px 80px rgba(26,18,38,0.18)",
        overflow: "hidden",
      }}>
        <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  if (mode === "torn") {
    // Irregular polygon clip — top edge flat-ish, bottom edge torn (zine).
    const clip = "polygon(2% 0%, 96% 1%, 100% 14%, 99% 92%, 92% 100%, 6% 98%, 0% 86%, 1% 8%)";
    return (
      <div style={{
        position: "absolute",
        top, left, width, height,
        transform: `rotate(${rotate}deg)`,
        background: surface,
        boxShadow: "0 24px 60px rgba(10,10,10,0.18)",
        clipPath: clip,
        overflow: "hidden",
      }}>
        <Img src={url} style={{
          width: "100%", height: "100%", objectFit: "cover",
          // Halftone overlay simulated with a layered radial-gradient mask.
          filter: "contrast(1.1) saturate(0.92)",
        }} />
        {/* Halftone dot texture on top — pseudo-random fixed-pattern dots. */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(0,0,0,0.18) 0.8px, transparent 1.2px)," +
            "radial-gradient(circle at 75% 75%, rgba(0,0,0,0.12) 0.8px, transparent 1.2px)",
          backgroundSize: "8px 8px, 8px 8px",
          mixBlendMode: "multiply",
        }} />
      </div>
    );
  }

  if (mode === "inset") {
    return (
      <div style={{
        position: "absolute",
        top, left, width, height,
        background: surface,
        border: `1px solid ${rule ?? "rgba(255,255,255,0.16)"}`,
        overflow: "hidden",
      }}>
        <Img src={url} style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: "grayscale(0.6) contrast(1.05)",
        }} />
      </div>
    );
  }

  // specimen — image bounded by corner brackets and registration ticks.
  if (mode === "specimen") {
    const T = 24; // tick length in px
    const cornerStyle: React.CSSProperties = {
      position: "absolute",
      width: T, height: T,
      borderColor: rule ?? "rgba(24,22,19,0.6)",
      borderStyle: "solid",
    };
    return (
      <div style={{ position: "absolute", top, left, width, height }}>
        <div style={{
          position: "absolute", inset: 0,
          background: surface,
          overflow: "hidden",
        }}>
          <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {/* Four corner brackets. */}
        <div style={{ ...cornerStyle, top: -T - 4, left: -4, borderWidth: "0 0 2px 2px" }} />
        <div style={{ ...cornerStyle, top: -T - 4, right: -4, borderWidth: "0 2px 2px 0" }} />
        <div style={{ ...cornerStyle, bottom: -T - 4, left: -4, borderWidth: "2px 0 0 2px" }} />
        <div style={{ ...cornerStyle, bottom: -T - 4, right: -4, borderWidth: "2px 2px 0 0" }} />
      </div>
    );
  }

  return null;
};
