// Gummy — Hyperreal 3D / Tactile / Gimme-Gummy template (2026 Trend:
// hyperreal 3D worlds, tactile rebellion, candy/jelly material).
//
// Concept: stacked 3D rounded tiles with thick offset shadows, candy
// palette, jelly-bounce springs on every entrance. Every element has
// material: a chunky shadow, a soft inner highlight, a slight rotation
// so the page feels physically arranged. Bg image (when present) sits
// inside a tilted rounded card, NEVER full-bleed.
//
// Differentiators:
//   - Only template with rounded tile cards + chunky offset shadow.
//   - Only template with jelly/spring overshoot motion (others use eased
//     curves or strict timing).
//   - Brightest most-saturated palette (vs. Aurora's ambient gradient,
//     Zine's photocopy paper, Kinetic's strict B&W, Dossier's cream).

import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, IMAGE_FRAME, fitHeadline, fitBody, fitStat } from "../layout";
import { jellyBounce, springStagger, easeOutBack } from "../animations";
import { BgImage } from "../shared/BgImage";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.gummy;
const FONTS = FONT.Gummy!;

export const defaultGummyProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "GUMMY", headline: "이번 주 큰 한 입", body: "핵심만 빠르게, 한 번에 한 입씩." },
    { kicker: "FACT", headline: "39.2조", body: "신용잔고 8주 연속 증가.", stat: { value: "39.2조" } },
    { kicker: "MOVE", headline: "끈적한 유동성", body: "달콤하지만 무겁다." },
    { kicker: "BITE", headline: "오늘 한 입", body: "짧고 분명한 행동." },
  ],
};

export const Gummy: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const list = slides.length ? slides : defaultGummyProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {/* Decorative gummy blobs in the background — pure CSS gradients,
          slight rotation. They DO NOT animate (per the redesign brief
          backdrop pieces stay put; only typography moves). */}
      <Backdrop />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 36, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 2,
          color: "rgba(26,18,38,0.4)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Backdrop: React.FC = () => (
  <>
    <div style={{
      position: "absolute", top: -120, right: -160, width: 580, height: 580,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, ${PALETTE.accent2} 0%, ${PALETTE.accent2}cc 60%, ${PALETTE.accent2}00 80%)`,
      filter: "blur(2px)", pointerEvents: "none",
    }} />
    <div style={{
      position: "absolute", bottom: -200, left: -180, width: 700, height: 700,
      borderRadius: "50%",
      background: `radial-gradient(circle at 65% 60%, ${PALETTE.accent3}88 0%, ${PALETTE.accent3}22 60%, transparent 78%)`,
      filter: "blur(2px)", pointerEvents: "none",
    }} />
  </>
);

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number; accent: string;
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });

  // Card 1: photo tile (only when bgImageUrl); upper region.
  // Card 2: headline tile, mid; jelly bounce.
  // Card 3: body tile, lower; staggered spring.
  const photoBounce = jellyBounce(frame, fps, { delay: 4 });
  const headlineBounce = jellyBounce(frame, fps, { delay: 10, amplitude: 0.22 });
  const bodyT = springStagger(frame, fps, 0, { delay: 18, config: { damping: 12, stiffness: 110 } });

  const headlineSize = fitHeadline(slide.headline, {
    max: 152, min: 72,
    columnPx: PAGE.width - PAGE.marginX * 2 - 80,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 36, min: 24 });

  const TILE_W = PAGE.width - PAGE.marginX * 2 - 24;
  const TILE_X = PAGE.marginX + 12;

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      {/* Photo tile — fixed frame from layout.ts. */}
      <div style={{ transformOrigin: "50% 50%", transform: photoBounce.transform, opacity: photoBounce.opacity }}>
        <BgImage
          url={slide.bgImageUrl}
          frame={IMAGE_FRAME.gummy}
          surface={PALETTE.surface}
        />
      </div>

      {/* Kicker pill — tiny rounded tag, single accent color. */}
      {slide.kicker ? (
        <div style={{
          position: "absolute", top: 96, left: TILE_X,
          background: PALETTE.text, color: PALETTE.bg,
          fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
          letterSpacing: 4, textTransform: "uppercase",
          padding: "12px 22px", borderRadius: 999,
          opacity: photoBounce.opacity,
          transform: `${photoBounce.transform} translateZ(0)`,
        }}>
          {slide.kicker}
        </div>
      ) : null}

      {/* Headline tile — large rounded card with the headline inside. The
          card itself is the visual; the type sits within. */}
      <div style={{
        position: "absolute",
        top: slide.bgImageUrl ? 1010 : 720,
        left: TILE_X, width: TILE_W,
        background: accent, color: "#1a1226",
        borderRadius: 48,
        padding: "56px 56px 48px 56px",
        boxShadow: "14px 14px 0 0 #1a1226, 0 32px 64px rgba(26,18,38,0.18)",
        transform: `${headlineBounce.transform} rotate(${interpolate(headlineBounce.opacity, [0,1], [-2, 0])}deg)`,
        opacity: headlineBounce.opacity,
        transformOrigin: "20% 100%",
      }}>
        <h1 style={{
          fontFamily: FONTS.display,
          fontSize: headlineSize, fontWeight: 900,
          lineHeight: 0.98, letterSpacing: "-0.035em",
          margin: 0, wordBreak: "keep-all", overflowWrap: "break-word",
        }}>
          {slide.headline}
        </h1>

        {/* Stat block — skip when the headline already IS the number
            (otherwise we'd render "39.2조" twice). Covers value alone
            and value+suffix so a headline of "39.2조" with
            stat {value:"39.2", suffix:"조"} is also caught. The label
            still appears as a tracked caption when we suppress. */}
        {(() => {
          const s = slide.stat;
          if (!s) return false;
          const composite = `${s.value}${s.suffix ?? ""}`.trim();
          const head = slide.headline.trim();
          return s.value !== head && composite !== head;
        })() && slide.stat ? (
          <div style={{ marginTop: 32, display: "flex", gap: 16, alignItems: "baseline" }}>
            <div style={{
              fontFamily: FONTS.display,
              fontSize: fitStat(slide.stat.value, { max: 132, min: 64 }),
              fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1,
              background: "#1a1226", color: PALETTE.accent2,
              padding: "8px 22px 14px 22px", borderRadius: 24,
              display: "inline-block",
            }}>
              {slide.stat.value}
            </div>
            {slide.stat.label ? (
              <span style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
                {slide.stat.label.toUpperCase()}
              </span>
            ) : null}
          </div>
        ) : slide.stat?.label ? (
          <div style={{
            marginTop: 18,
            fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, letterSpacing: 4,
            textTransform: "uppercase", color: "#1a1226", opacity: 0.7,
          }}>
            {slide.stat.label}
          </div>
        ) : null}
      </div>

      {/* Body tile — sits below, smaller, slight rotation other direction. */}
      {slide.body ? (
        <div style={{
          position: "absolute",
          bottom: PAGE.safeBottom - 24,
          left: TILE_X, width: TILE_W,
          background: PALETTE.surface,
          borderRadius: 32,
          padding: "30px 36px",
          boxShadow: "10px 10px 0 0 rgba(26,18,38,0.92)",
          transform: `translateY(${(1 - bodyT) * 60}px) rotate(${(1 - bodyT) * 2}deg)`,
          opacity: bodyT,
        }}>
          <p style={{
            fontFamily: FONTS.body, fontSize: bodySize, fontWeight: 500,
            lineHeight: 1.45, letterSpacing: "-0.01em",
            margin: 0, color: PALETTE.text,
            wordBreak: "keep-all", overflowWrap: "break-word",
          }}>
            {slide.body}
          </p>
        </div>
      ) : null}

      {/* Page chip — tiny circular badge bottom right. */}
      <div style={{
        position: "absolute", bottom: PAGE.safeBottom - 132, right: PAGE.marginX,
        width: 64, height: 64, borderRadius: "50%",
        background: PALETTE.text, color: PALETTE.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONTS.mono, fontSize: 18, fontWeight: 900,
        letterSpacing: -1, fontFeatureSettings: "'tnum'",
        transform: `scale(${easeOutBack(Math.min(1, frame / 24))})`,
      }}>
        {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
