// KineticType — 단어 단위로 펑펑 등장하는 키네틱 타이포그래피.
// 미니멀 잉크 BG + 거대 타이포 + 워드 마스크 와이프. 시선을 단어로 끌고 다님.
//
// 디자인 컨셉: Apple keynote / Pentagram / SoulCycle 스타일.
// 시청자가 "한 단어씩 강제로 읽게" 만들어 retention을 잡는다.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { chromaShadow, kenBurns, splitTextProgress } from "../animations";

const SLIDE_FRAMES = 96;

export const defaultKineticTypeProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "HOOK", headline: "지금 안 보면 늦어요" },
    { headline: "왜 다들 멈췄는가" },
    { headline: "딱 3가지만 기억해" },
    { headline: "1. 시작은 가볍게" },
    { headline: "2. 매주 한 번 점검" },
    { headline: "지금 저장하세요", emphasis: "🔖" },
  ],
};

export const KineticType: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const fontFamily = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultKineticTypeProps.slides;
  const palette = palettes.ink;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, fontFamily, color: palette.text, overflow: "hidden", perspective: "1600px" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}
      <NoiseBg accent={accentColor} />
      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <KineticSlide slide={s} index={i} total={list.length} fps={fps} accent={accentColor} fontFamily={fontFamily} />
        </Sequence>
      ))}
      <DotProgress total={list.length} accent={accentColor} />
      <BrandStamp brand={brand} accent={accentColor} />
      {attribution ? <Attribution text={attribution} /> : null}
    </AbsoluteFill>
  );
};

const KineticSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string; fontFamily: string }> = ({
  slide, index, fps, accent,
}) => {
  const frame = useCurrentFrame();
  const words = slide.headline.split(/\s+/);
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 96 }}>
      {slide.bgImageUrl ? (
        <Img
          src={slide.bgImageUrl}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.3, transform: kenBurns(frame, SLIDE_FRAMES, "diag"),
            filter: "saturate(1.1) contrast(1.05)",
          }}
        />
      ) : null}

      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 30% 40%, ${accent}1f, transparent 55%)`,
      }} />

      {slide.kicker ? (
        <div style={{
          position: "absolute", top: 220, left: 0, right: 0,
          fontSize: 28, fontWeight: 800, letterSpacing: 12, textAlign: "center",
          color: accent, opacity: spring({ frame, fps, config: { damping: 18 } }) * exit,
          textTransform: "uppercase",
        }}>
          {slide.kicker}
        </div>
      ) : null}

      <div style={{
        textAlign: "center", maxWidth: 920,
        opacity: exit,
        textShadow: index === 0 ? chromaShadow(2) : undefined,
        transformStyle: "preserve-3d",
      }}>
        {words.map((w, i) => {
          const t = splitTextProgress(frame, fps, i, { startFrame: 8, perItemFrames: 6, durationFrames: 16 });
          // 3D pop — words rotate up from rotateX(60deg) into 0 with depth.
          const rx = (1 - t) * 60;
          const tz = (1 - t) * -120;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontSize: words.length > 4 ? (words.length > 6 ? 92 : 110) : 138,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                marginRight: 22,
                opacity: t,
                transform: `translateY(${(1 - t) * 50}px) translateZ(${tz}px) rotateX(${rx}deg) scale(${0.92 + 0.08 * t})`,
                transformOrigin: "50% 100%",
                color: i === 0 && index === 0 ? accent : "inherit",
              }}
            >
              {w}
            </span>
          );
        })}

        {slide.body ? (
          <div style={{
            fontSize: 36, color: "rgba(250,250,250,0.65)", marginTop: 56, lineHeight: 1.4,
            opacity: interpolate(frame, [24, 40], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {slide.body}
          </div>
        ) : null}

        {slide.emphasis ? (
          <div style={{
            fontSize: 140, marginTop: 24,
            transform: `scale(${spring({ frame: frame - 18, fps, config: { damping: 8, stiffness: 180 } })})`,
            filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.5))",
          }}>
            {slide.emphasis}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const NoiseBg: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: `radial-gradient(circle at ${50 + Math.sin(frame / 60) * 10}% ${50 + Math.cos(frame / 70) * 10}%, ${accent}14, transparent 50%)`,
    }} />
  );
};

const DotProgress: React.FC<{ total: number; accent: string }> = ({ total, accent }) => {
  const frame = useCurrentFrame();
  const slideIndex = Math.min(total - 1, Math.floor(frame / SLIDE_FRAMES));
  return (
    <div style={{ position: "absolute", top: 64, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === slideIndex;
        return (
          <div key={i} style={{
            width: active ? 36 : 8, height: 8, borderRadius: 4,
            background: active ? accent : "rgba(255,255,255,0.2)",
            transition: "all 200ms",
          }} />
        );
      })}
    </div>
  );
};

const BrandStamp: React.FC<{ brand: { handle: string; name: string }; accent: string }> = ({ brand, accent }) => (
  <div style={{
    position: "absolute", bottom: 140, left: 0, right: 0,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
    fontSize: 24, color: "rgba(255,255,255,0.7)", letterSpacing: 3,
  }}>
    <div style={{ width: 6, height: 6, background: accent, borderRadius: 3 }} />
    <span style={{ fontWeight: 800, color: "#fff" }}>{brand.name.toUpperCase()}</span>
    <span style={{ opacity: 0.5 }}>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontSize: 16, color: "rgba(255,255,255,0.4)" }}>
    {text}
  </div>
);
