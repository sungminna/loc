// Kinetic — Typographic Maximalism template (2026 Trend: kinetic
// typography, type-as-motion, variable-font weight morph).
//
// Concept: TYPE IS THE LAYOUT. The headline fills the slide; weight
// morphs from light to black across the slide's life; words scramble in.
// Strict palette — pure black/white plus ONE neon hit. Bg image (when
// present) is a small monochrome inset, treated as a stamp behind the
// type, so the photograph never competes with the typography.
//
// Differentiators:
//   - Only template that morphs Pretendard / Geist's variable wght axis
//     live (200..880).
//   - Only template where typography is the ENTIRE design — no tiles,
//     no gradients, no collage.
//   - Strictest palette: black + white + a single chartreuse note.
//   - Smallest image footprint (280×280 inset vs full bleed / 760-tall
//     tiles in Aurora / Gummy / Zine).

import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, IMAGE_FRAME, fitHeadline, fitBody, fitStat, folioStamp } from "../layout";
import { weightMorph, weightPulse, scrambleText, marquee, countUp } from "../animations";
import { BgImage } from "../shared/BgImage";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.kinetic;
const FONTS = FONT.Kinetic!;

export const defaultKineticProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "K-01", headline: "BIG TYPE", body: "타이포 그 자체가 디자인이다." },
    { kicker: "DATA", headline: "39.2조", body: "신용잔고 8주 연속 증가.", stat: { value: "39.2조" } },
    { kicker: "RULE", headline: "스크램블", body: "글자가 슈류륙 바뀌어서 결과로 나온다." },
    { kicker: "END", headline: "다음 페이지", body: "이어서." },
  ],
};

export const Kinetic: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const list = slides.length ? slides : defaultKineticProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {/* Vertical edge marquee — KINETIC repeating along the right edge. */}
      <EdgeMarquee />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 3,
          color: "rgba(255,255,255,0.4)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const EdgeMarquee: React.FC = () => {
  const frame = useCurrentFrame();
  const y = marquee(frame, 1900, 360);
  const items = Array.from({ length: 60 }, (_, i) => ["KINETIC", "TYPE", "·"][i % 3]);
  return (
    <div style={{
      position: "absolute", top: 0, right: 0, width: 56, height: PAGE.height,
      borderLeft: `1px solid ${PALETTE.rule}`,
      overflow: "hidden",
      writingMode: "vertical-rl",
      textOrientation: "mixed",
    }}>
      <div style={{
        whiteSpace: "nowrap",
        fontFamily: PALETTES.kinetic.text === "#ffffff" ? "'Geist Mono', monospace" : "monospace",
        fontSize: 16, fontWeight: 700, letterSpacing: 8,
        color: PALETTE.textMuted,
        transform: `translateY(${y}px)`,
        padding: "120px 0",
      }}>
        {items.map((w, i) => (
          <span key={i} style={{ marginBottom: 24, display: "inline-block" }}>{w}</span>
        ))}
      </div>
    </div>
  );
};

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number; accent: string;
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 110 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  const headlineSize = fitHeadline(slide.headline, {
    max: 248, min: 96,
    columnPx: PAGE.width - PAGE.marginX * 2 - 56,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 30, min: 22 });

  // Variable-font weight morph: starts light, settles heavy by 90% of slide.
  const headlineWeight = weightMorph(frame, SLIDE_FRAMES - 30, { from: 240, to: 880, startFrame: 0 });
  const kickerWeight = weightPulse(frame, { min: 380, max: 720, periodFrames: 70 });

  return (
    <AbsoluteFill>
      {/* Small inset image — monochrome stamp, fixed position. */}
      <BgImage
        url={slide.bgImageUrl}
        frame={IMAGE_FRAME.kinetic}
        surface={PALETTE.surface}
        rule={PALETTE.rule}
      />

      {/* Top kicker — mono, accent dot. Pulses weight. */}
      {slide.kicker ? (
        <div style={{
          position: "absolute", top: PAGE.safeTop - 32, left: PAGE.marginX,
          fontFamily: FONTS.body, fontSize: 22,
          fontVariationSettings: kickerWeight,
          letterSpacing: 8, textTransform: "uppercase",
          color: accent,
          opacity,
        }}>
          ● {scrambleText(slide.kicker, frame, { startFrame: 0, perCharFrames: 2 })}
        </div>
      ) : null}

      {/* HEADLINE — fills the slide. Weight morphs over the slide's life. */}
      <div style={{
        position: "absolute",
        top: slide.bgImageUrl ? 540 : 380,
        left: PAGE.marginX, right: PAGE.marginX,
        opacity,
      }}>
        <h1 style={{
          fontFamily: FONTS.display,
          fontSize: headlineSize,
          fontVariationSettings: headlineWeight,
          fontWeight: 900,           // Fallback for non-variable face
          lineHeight: 0.92, letterSpacing: "-0.045em",
          color: PALETTE.text,
          margin: 0,
          wordBreak: "keep-all", overflowWrap: "break-word",
          transform: `translateY(${(1 - enter) * 32}px)`,
        }}>
          {slide.headline}
        </h1>

        {/* Stat row — count-up if numeric, else just the value. We skip
            this block when the headline already IS the stat value
            (would otherwise render the number twice). The check covers
            the value alone AND value+suffix so a headline of "39.2조"
            with stat {value:"39.2", suffix:"조"} is also caught. The
            label still renders as a tracked caption below the headline
            so the "신용잔고" context is never lost. */}
        {(() => {
          const s = slide.stat;
          if (!s) return false;
          const composite = `${s.value}${s.suffix ?? ""}`.trim();
          const head = slide.headline.trim();
          return s.value !== head && composite !== head;
        })() && slide.stat ? (
          <div style={{
            display: "flex", alignItems: "baseline", gap: 24,
            marginTop: 36,
          }}>
            <span style={{
              fontFamily: FONTS.display,
              fontSize: fitStat(slide.stat.value, { max: 96, min: 48 }),
              color: accent,
              fontVariationSettings: "'wght' 800",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}>
              {/^[\d.,]+/.test(slide.stat.value)
                ? countUp(frame, parseFloat(slide.stat.value.replace(/[^\d.]/g, "")) || 0, {
                    startFrame: 8, durationFrames: 36, suffix: slide.stat.value.replace(/^[\d.,]+/, ""),
                    decimals: slide.stat.value.includes(".") ? 1 : 0,
                  })
                : slide.stat.value}
            </span>
            {slide.stat.label ? (
              <span style={{
                fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
                letterSpacing: 4, textTransform: "uppercase",
                color: PALETTE.textMuted,
              }}>
                {slide.stat.label}
              </span>
            ) : null}
          </div>
        ) : slide.stat?.label ? (
          <div style={{
            marginTop: 24,
            fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
            letterSpacing: 4, textTransform: "uppercase",
            color: accent,
          }}>
            ▸ {slide.stat.label}{slide.stat.suffix ? ` (${slide.stat.suffix})` : ""}
          </div>
        ) : null}
      </div>

      {/* Body — bottom, small, mono-ish, single line accent. */}
      {slide.body ? (
        <div style={{
          position: "absolute",
          bottom: PAGE.safeBottom - 24,
          left: PAGE.marginX, right: PAGE.marginX + 56,
          borderTop: `1px solid ${PALETTE.rule}`,
          paddingTop: 24,
          opacity,
        }}>
          <p style={{
            fontFamily: FONTS.body, fontSize: bodySize,
            fontWeight: 400, lineHeight: 1.45, letterSpacing: "-0.008em",
            margin: 0, color: PALETTE.textMuted,
            wordBreak: "keep-all", overflowWrap: "break-word",
          }}>
            {slide.body}
          </p>
        </div>
      ) : null}

      {/* Bottom-left folio — tiny mono. */}
      <div style={{
        position: "absolute", bottom: PAGE.safeBottom - 110, left: PAGE.marginX,
        fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700,
        letterSpacing: 6, color: PALETTE.textMuted,
        textTransform: "uppercase",
      }}>
        {folioStamp(index, total)} · KINETIC/26
      </div>
    </AbsoluteFill>
  );
};
