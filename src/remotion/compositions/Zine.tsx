// Zine — Counterculture / Punk / Pick-and-Mix template (2026 Trend:
// counterculture codes, ransom-note typography, photocopy aesthetic,
// "Warning Low Ink" + "Pick and Mix" + "Blotch").
//
// Concept: ransom-note collage. Mixed weights and styles per word, paper
// kicker stamps, halftone overlay on the image, mono ticker at the foot.
// Type tilts off the grid by a few degrees per word so the page reads
// hand-pasted. Bg image (when present) is clipped into a torn-edge card,
// tilted, with halftone overlay.
//
// Differentiators:
//   - Only template that mixes display/serif/mono in the SAME headline.
//   - Only template with photocopy texture, halftone, and per-word random
//     rotation jitter.
//   - Acid-yellow + risograph-red palette is unique vs. the others.

import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, IMAGE_FRAME, fitHeadline, fitBody } from "../layout";
import { glitchJitter, marquee, pseudoRandom, scrambleText } from "../animations";
import { BgImage } from "../shared/BgImage";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.zine;
const FONTS = FONT.Zine!;

export const defaultZineProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "ZINE №07", headline: "ALL EYES ON THIS", body: "오늘의 카운터컬처. 종이와 풀로 붙인 한 페이지." },
    { kicker: "BREAK", headline: "흔들리는 신호", body: "익숙한 틀이 부서지는 자리." },
    { kicker: "CUT", headline: "잘라내야 할 것", body: "관성으로 굴러간 것들." },
    { kicker: "PASTE", headline: "지금 붙여 둘 한 장", body: "내일 다시 보지 말기." },
  ],
};

export const Zine: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const list = slides.length ? slides : defaultZineProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {/* Photocopy paper grain — pure CSS, faint. Static. */}
      <PaperGrain />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      {/* Mast — ZINE wordmark with mono date. */}
      <Mast />

      {/* Foot ticker — marquee of generic zine vocabulary. */}
      <Ticker />

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 2,
          color: "rgba(10,10,10,0.45)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const PaperGrain: React.FC = () => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.04) 1px, transparent 2px)," +
      "radial-gradient(circle at 70% 80%, rgba(0,0,0,0.03) 1px, transparent 2px)",
    backgroundSize: "5px 5px, 7px 7px",
    mixBlendMode: "multiply",
  }} />
);

const Mast: React.FC = () => (
  <div style={{
    position: "absolute", top: 56, left: PAGE.marginX, right: PAGE.marginX,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontFamily: FONTS.display, fontSize: 28, fontWeight: 900,
    letterSpacing: 2, color: PALETTE.text,
    textTransform: "uppercase",
  }}>
    <span style={{
      background: PALETTE.text, color: PALETTE.accent2,
      padding: "6px 14px", display: "inline-block",
      transform: "rotate(-1.2deg)",
    }}>
      ZINE / 26
    </span>
    <span style={{ fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 4, fontWeight: 700 }}>
      ISSUE №07 — PRINT &amp; PASTE
    </span>
  </div>
);

const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  // Single-line marquee at the foot — words are deterministic, no Math.random.
  const items = Array.from({ length: 40 }, (_, i) => [
    "PASTE", "CUT", "GLUE", "WARNING:LOW INK", "STILL HERE", "RAW", "IF YOU SEE THIS",
  ][i % 7]);
  const x = marquee(frame, 2200, 360);
  return (
    <div style={{
      position: "absolute", bottom: 38, left: 0, right: 0,
      height: 44, overflow: "hidden",
      borderTop: `2px solid ${PALETTE.text}`,
      borderBottom: `2px solid ${PALETTE.text}`,
      display: "flex", alignItems: "center",
      background: PALETTE.accent2,
    }}>
      <div style={{
        whiteSpace: "nowrap",
        fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, letterSpacing: 4,
        color: PALETTE.text,
        transform: `translateX(${x}px)`,
      }}>
        {items.map((w, i) => (
          <span key={i} style={{ marginRight: 36 }}>★ {w}</span>
        ))}
      </div>
    </div>
  );
};

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number; accent: string;
}

// Pick a per-word style index deterministically from (slideIndex, wordIndex)
// so previews match renders. We mix three "looks" — black sans, italic
// serif, mono — to read as ransom-note collage.
function wordStyle(slideIdx: number, wordIdx: number, base: { sans: string; serif: string; mono: string }) {
  const r = pseudoRandom(slideIdx * 7 + wordIdx, 11);
  if (r < 0.55) return { fontFamily: base.sans, fontStyle: "normal" as const, fontWeight: 900 };
  if (r < 0.85) return { fontFamily: base.serif, fontStyle: "italic" as const, fontWeight: 700 };
  return { fontFamily: base.mono, fontStyle: "normal" as const, fontWeight: 700 };
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 130 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  const headlineSize = fitHeadline(slide.headline, {
    max: 156, min: 64,
    columnPx: PAGE.width - PAGE.marginX * 2,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 32, min: 22 });

  const j = glitchJitter(frame, index + 1, 0.8);

  return (
    <AbsoluteFill>
      {/* Bg image — torn-edge card, tilted, halftone overlay handled by BgImage. */}
      <BgImage
        url={slide.bgImageUrl}
        frame={IMAGE_FRAME.zine}
        surface={PALETTE.bgFlat}
      />

      {/* Acid-yellow stamp behind headline — diagonal block with kicker text scrambled in. */}
      {slide.kicker ? (
        <div style={{
          position: "absolute", top: 1080,
          left: PAGE.marginX - 8,
          background: PALETTE.accent, color: PALETTE.bg,
          padding: "12px 22px", display: "inline-block",
          fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, letterSpacing: 6,
          textTransform: "uppercase",
          transform: `rotate(-2.5deg) translate(${j.x}px, ${j.y}px)`,
          opacity,
        }}>
          {scrambleText(slide.kicker, frame, { startFrame: 4, perCharFrames: 2 })}
        </div>
      ) : null}

      {/* Headline — per-word style mix + per-word rotation. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        top: 1170,
        opacity,
      }}>
        <h1 style={{
          fontSize: headlineSize, lineHeight: 0.95, letterSpacing: "-0.02em",
          color: PALETTE.text, margin: 0,
          textTransform: "uppercase",
          wordBreak: "keep-all", overflowWrap: "break-word",
          fontFamily: FONTS.display,
        }}>
          {slide.headline.split(/\s+/).map((w, i) => {
            const enterT = spring({ frame: frame - i * 3, fps, config: { damping: 12, stiffness: 130 } });
            const rot = (pseudoRandom(index * 11 + i, 5) - 0.5) * 8;
            const style = wordStyle(index, i, { sans: FONTS.display, serif: "'Instrument Serif', serif", mono: FONTS.mono });
            const useAccent = pseudoRandom(index * 7 + i, 3) < 0.18;
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: ".18em",
                transform: `translateY(${(1 - enterT) * 24}px) rotate(${rot}deg)`,
                opacity: enterT,
                color: useAccent ? accent : PALETTE.text,
                ...style,
              }}>
                {w}
              </span>
            );
          })}
        </h1>
      </div>

      {/* Body — typewriter mono on a paper-block with offset shadow. */}
      {slide.body ? (
        <div style={{
          position: "absolute",
          bottom: PAGE.safeBottom + 30,
          left: PAGE.marginX, right: PAGE.marginX,
          opacity,
        }}>
          <div style={{
            background: PALETTE.text, color: PALETTE.bg,
            padding: "26px 32px",
            boxShadow: `8px 8px 0 0 ${accent}`,
            transform: `rotate(0.6deg) translate(${j.x * 0.4}px, ${j.y * 0.4}px)`,
          }}>
            <p style={{
              fontFamily: FONTS.body, fontSize: bodySize,
              fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.005em",
              margin: 0,
              wordBreak: "keep-all", overflowWrap: "break-word",
            }}>
              {slide.body}
            </p>
          </div>
        </div>
      ) : null}

      {/* Page numeral — large stamp top right. */}
      <div style={{
        position: "absolute", top: 178, right: PAGE.marginX,
        fontFamily: FONTS.display, fontSize: 96, fontWeight: 900,
        color: PALETTE.text,
        transform: `rotate(2deg) translate(${j.x}px, ${j.y}px)`,
        lineHeight: 1,
      }}>
        №{String(index + 1).padStart(2, "0")}
      </div>
      <div style={{
        position: "absolute", top: 280, right: PAGE.marginX,
        fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700, letterSpacing: 4,
        color: PALETTE.text, opacity: 0.7,
      }}>
        OF {String(total).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
