// Aurora — Atmospheric Gradient template (2026 Trend: Atmospheric
// Gradients / Cool Blue / Drama Club).
//
// Concept: cinematic radial gradient as ambient sky. Type FLOATS in the
// color field with a slow parallax breath. Dramatic, softly cinematic,
// negative-space-first. The bg image (when present) is full-bleed scenery
// with a vertical scrim that lifts the typography off without moving the
// photo (no Ken Burns — per the redesign brief, the image is fixed).
//
// Differentiators vs. the other four templates:
//   - Only template that uses a gradient field as the page (others are
//     flat paper, candy cream, ink black, or photocopy paper).
//   - Only template with parallax-floating type (all others animate on
//     entry and rest, or use stricter motion grammars).
//   - Lightest grotesque weights (300/400) for the body — opposite end of
//     the weight spectrum from Gummy/Kinetic/Zine which are 700+.

import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, IMAGE_FRAME, fitHeadline, fitBody, folioStamp } from "../layout";
import { parallaxFloat, splitTextProgress } from "../animations";
import { BgImage } from "../shared/BgImage";

const SLIDE_FRAMES = 168;
const PALETTE = PALETTES.aurora;
const FONTS = FONT.Aurora!;

export const defaultAuroraProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "AURORA · 01", headline: "고요한 신호", body: "이 분기 가장 조용한 변화가 가장 큰 결과를 만든다." },
    { kicker: "DRIFT", headline: "관찰된 것", body: "노이즈가 줄어든 자리에서 패턴이 모습을 드러낸다." },
    { kicker: "DEPTH", headline: "보이지 않는 층", body: "표면 아래의 흐름은 표면의 가격보다 길게 산다." },
    { kicker: "RETURN", headline: "돌아오는 질문", body: "오늘 결정할 단 한 가지." },
  ],
};

export const Aurora: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const list = slides.length ? slides : defaultAuroraProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      {/* Brand mark — minimal, tracked light grotesque, top right. */}
      <Mast />

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 36, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 2,
          color: "rgba(244,240,255,0.4)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Mast: React.FC = () => (
  <>
    {/* Subtle dark scrim behind the mast — the top of Aurora's radial
        gradient is bright lilac, where white text on lilac is unreadable.
        A thin gradient scrim at the top adds enough contrast. */}
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 200,
      background: "linear-gradient(180deg, rgba(10,14,42,0.55) 0%, rgba(10,14,42,0) 100%)",
      pointerEvents: "none",
    }} />
    <div style={{
      position: "absolute", top: PAGE.safeTop - 56, left: PAGE.marginX, right: PAGE.marginX,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 6, fontWeight: 700,
      color: "#f4f0ff", opacity: 0.95,
      textTransform: "uppercase",
    }}>
      <span>AURORA · 26</span>
      <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: PALETTE.accent }} />
        DISPATCH
      </span>
    </div>
  </>
);

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number; accent: string;
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 80 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;
  const float = parallaxFloat(frame, { amplitudeY: 8, amplitudeX: 4, periodFrames: 280 });

  const headlineSize = fitHeadline(slide.headline, {
    max: 168, min: 72,
    columnPx: PAGE.width - PAGE.marginX * 2,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 38, min: 26 });

  return (
    <AbsoluteFill>
      {/* Bg image — full bleed, fixed. Scrim baked in. */}
      <BgImage
        url={slide.bgImageUrl}
        frame={IMAGE_FRAME.aurora}
        surface={PALETTE.bgFlat}
        scrim={PALETTE.scrim}
      />

      {/* Centered type column. parallaxFloat gives the breathing life. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        top: 380,
        opacity,
        transform: `translate(${float.x}px, ${float.y + (1 - enter) * 24}px)`,
      }}>
        {slide.kicker ? (
          // Inline pill — the radial-gradient field is brightest at
          // 30%/15% (where the kicker often sits), so a translucent
          // dark pill keeps the kicker contrast-locked regardless of
          // where on the field it lands. Backdrop-filter blur adds a
          // glassy diffusion that reads as ambient, not boxy.
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(10,14,42,0.36)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(244,240,255,0.12)",
            borderRadius: 999,
            padding: "8px 18px",
            opacity,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 4, background: accent,
              boxShadow: `0 0 12px ${accent}`,
            }} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700,
              letterSpacing: 5, color: "#f4f0ff", textTransform: "uppercase",
            }}>
              {slide.kicker}
            </span>
          </div>
        ) : null}

        <h1 style={{
          fontFamily: FONTS.display,
          fontSize: headlineSize, fontWeight: 300,
          lineHeight: 1.05, letterSpacing: "-0.03em",
          margin: "44px 0 0 0",
          color: PALETTE.text,
          wordBreak: "keep-all", overflowWrap: "break-word",
          textShadow: "0 8px 32px rgba(10,14,42,0.45)",
        }}>
          {slide.headline.split(/\s+/).map((w, i) => {
            const t = splitTextProgress(frame, fps, i, { startFrame: 8, perItemFrames: 5, durationFrames: 22 });
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: ".22em",
                opacity: t,
                transform: `translateY(${(1 - t) * 28}px)`,
                filter: `blur(${(1 - t) * 4}px)`,
              }}>{w}</span>
            );
          })}
        </h1>

        {slide.body ? (
          <p style={{
            fontFamily: FONTS.body, fontSize: bodySize, fontWeight: 300,
            lineHeight: 1.55, letterSpacing: "-0.005em",
            margin: "44px 0 0 0",
            maxWidth: 720,
            color: PALETTE.textMuted,
            wordBreak: "keep-all", overflowWrap: "break-word",
          }}>
            {slide.body}
          </p>
        ) : null}

        {slide.emphasis ? (
          <div style={{
            fontFamily: FONTS.display, fontSize: 132, fontWeight: 200,
            color: accent, marginTop: 36, lineHeight: 1, letterSpacing: "-0.04em",
            opacity: 0.92,
          }}>
            {slide.emphasis}
          </div>
        ) : null}
      </div>

      {/* Bottom folio — tnum mono, tracked. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        bottom: PAGE.safeBottom - 70,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: FONTS.mono, fontSize: 14, letterSpacing: 6,
        color: "rgba(244,240,255,0.5)", fontFeatureSettings: "'tnum'",
        textTransform: "uppercase",
      }}>
        <span>FOLIO</span>
        <span>{folioStamp(index, total)}</span>
      </div>
    </AbsoluteFill>
  );
};
