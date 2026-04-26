// GlassMorphism — 프로스티드 글래스 카드 + 그라데이션 BG. iOS 16+ /
// Apple Vision Pro 톤. 카드가 부드럽게 떠오르고, BG는 항상 약간 움직인다.
//
// 너무 자극적이지 않으면서 고급감으로 retention을 잡는 컨셉. 블러된 BG가
// 감각적인 분위기를 만들고, 카드 안의 정보는 명확하게 정리.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { kenBurns } from "../animations";

const SLIDE_FRAMES = 96;

export const defaultGlassMorphismProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "MOMENT", headline: "오늘의 기분", body: "잠깐 멈추고 들여다 볼 한 가지." },
    { kicker: "INSIGHT", headline: "왜 그런 기분일까", body: "익숙함과 낯섦의 경계에서 일어나는 작은 신호." },
    { kicker: "SOFTLY", headline: "이렇게 해보세요", body: "오늘 한 줄, 손글씨로 적기." },
    { kicker: "SAVE", headline: "다시 보고 싶다면", emphasis: "🔖" },
  ],
};

export const GlassMorphism: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultGlassMorphismProps.slides;

  return (
    <AbsoluteFill style={{ background: "#1a0c2e", color: "#f5f5fa", fontFamily: font, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      <ChromaBg />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <GlassSlide slide={s} index={i} total={list.length} fps={fps} />
        </Sequence>
      ))}

      <Brand brand={brand} />
      {attribution ? <Attribution text={attribution} /> : null}
    </AbsoluteFill>
  );
};

const ChromaBg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <>
      <div style={{
        position: "absolute", width: 1200, height: 1200,
        left: 200 + Math.sin(t * 0.3) * 80, top: -200 + Math.cos(t * 0.4) * 60,
        background: "radial-gradient(circle, rgba(255,107,180,0.55) 0%, transparent 60%)",
        filter: "blur(80px)",
      }} />
      <div style={{
        position: "absolute", width: 1100, height: 1100,
        right: 200 - Math.cos(t * 0.35) * 100, bottom: -200 + Math.sin(t * 0.25) * 80,
        background: "radial-gradient(circle, rgba(120,180,255,0.55) 0%, transparent 60%)",
        filter: "blur(90px)",
      }} />
      <div style={{
        position: "absolute", width: 900, height: 900,
        left: 400 + Math.sin(t * 0.5) * 120, top: 600 + Math.cos(t * 0.45) * 80,
        background: "radial-gradient(circle, rgba(255,228,92,0.35) 0%, transparent 60%)",
        filter: "blur(100px)",
      }} />
    </>
  );
};

const GlassSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number }> = ({ slide, index, total, fps }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7, stiffness: 100 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.55, transform: kenBurns(frame, SLIDE_FRAMES, "in"),
          filter: "saturate(1.3) blur(2px)",
        }} />
      ) : null}

      <div style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
        backdropFilter: "blur(40px) saturate(1.4)",
        WebkitBackdropFilter: "blur(40px) saturate(1.4)",
        borderRadius: 56,
        padding: "72px 64px",
        width: "100%", maxWidth: 880,
        boxShadow: "0 30px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
        textAlign: "center",
        opacity,
        transform: `translateY(${(1 - enter) * 60}px) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
      }}>
        {slide.kicker ? (
          <div style={{
            display: "inline-block", padding: "8px 18px", marginBottom: 32,
            background: "rgba(255,255,255,0.12)", borderRadius: 999,
            fontSize: 20, fontWeight: 700, letterSpacing: 6,
            color: "#fff", textTransform: "uppercase",
          }}>
            {slide.kicker}
          </div>
        ) : null}

        <h1 style={{
          fontSize: index === 0 ? 96 : 80,
          lineHeight: 1.1, fontWeight: 900, margin: 0,
          letterSpacing: "-0.02em",
          background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {slide.headline}
        </h1>

        {slide.body ? (
          <p style={{ fontSize: 38, lineHeight: 1.45, color: "rgba(255,255,255,0.78)", marginTop: 32 }}>
            {slide.body}
          </p>
        ) : null}

        {slide.emphasis ? (
          <div style={{ fontSize: 130, marginTop: 24 }}>{slide.emphasis}</div>
        ) : null}

        <div style={{
          marginTop: 56, fontSize: 18, color: "rgba(255,255,255,0.55)", letterSpacing: 5,
        }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Brand: React.FC<{ brand: { handle: string; name: string } }> = ({ brand }) => (
  <div style={{
    position: "absolute", bottom: 64, left: 0, right: 0,
    display: "flex", justifyContent: "center", gap: 16, alignItems: "center",
    fontSize: 24, color: "rgba(255,255,255,0.7)", letterSpacing: 3,
  }}>
    <span style={{ fontWeight: 700, color: "#fff" }}>{brand.name}</span>
    <span>·</span>
    <span>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center",
    fontSize: 16, color: "rgba(255,255,255,0.4)",
  }}>{text}</div>
);
