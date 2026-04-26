import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export interface CardNewsSlide {
  kicker?: string;
  headline: string;
  body?: string;
  emphasis?: string;
  bgImageUrl?: string;
}

export interface CardNewsProps {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  slides: CardNewsSlide[];
  audioUrl?: string;
  attribution?: string;
}

export const defaultCardNewsProps: CardNewsProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "TREND", headline: "오늘의 키워드", body: "지금 가장 뜨거운 주제 한 줄 요약." },
    { headline: "Why it matters", body: "왜 이 트렌드를 알아야 하는지." },
    { headline: "The shift", body: "변하는 것 vs 그대로인 것." },
    { headline: "Action", body: "이번 주에 시도해볼 것 3가지." },
    { headline: "Save this", body: "다음에 써먹을 수 있게 저장.", emphasis: "🔖" },
  ],
};

const SLIDE_FRAMES = 90; // 3초 @ 30fps

export const CardNews: React.FC<CardNewsProps> = ({ brand, lang, slides, audioUrl, attribution }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const fontFamily = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;

  const slidesToRender = slides.length ? slides : defaultCardNewsProps.slides;

  return (
    <AbsoluteFill style={{ background: theme.bgGradient, fontFamily, color: theme.text }}>
      <BackdropBlobs />
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      {slidesToRender.map((slide, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Slide slide={slide} index={i} total={slidesToRender.length} fps={fps} fontFamily={fontFamily} />
        </Sequence>
      ))}

      <ProgressBar total={slidesToRender.length} frame={frame} />
      <Watermark brand={brand} />
      {attribution ? <Attribution text={attribution} /> : null}

      <FrameDecor width={width} height={height} />
    </AbsoluteFill>
  );
};

const BackdropBlobs: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame / 30) * 8;
  return (
    <>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: -200 + drift,
          top: -150,
          background: `radial-gradient(circle, ${theme.accent}33 0%, transparent 60%)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -250 - drift,
          bottom: -200,
          background: `radial-gradient(circle, ${theme.accentAlt}33 0%, transparent 60%)`,
          filter: "blur(80px)",
        }}
      />
    </>
  );
};

interface SlideProps {
  slide: CardNewsSlide;
  index: number;
  total: number;
  fps: number;
  fontFamily: string;
}

const Slide: React.FC<SlideProps> = ({ slide, index, total, fps, fontFamily }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 120 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 12, SLIDE_FRAMES + 12], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;
  const translateY = interpolate(enter, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 96 }}>
      {slide.bgImageUrl ? (
        <Img
          src={slide.bgImageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.45 * opacity,
            filter: "saturate(1.2)",
          }}
        />
      ) : null}

      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          background: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          backdropFilter: "blur(24px)",
          borderRadius: 48,
          padding: "72px 64px",
          width: "100%",
          maxWidth: 880,
          textAlign: "center",
          fontFamily,
        }}
      >
        {slide.kicker ? (
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 6,
              color: theme.accent,
              marginBottom: 32,
              textTransform: "uppercase",
            }}
          >
            {slide.kicker}
          </div>
        ) : null}

        <h1
          style={{
            fontSize: index === 0 ? 96 : 80,
            lineHeight: 1.1,
            fontWeight: 900,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {slide.headline}
        </h1>

        {slide.body ? (
          <p style={{ fontSize: 38, lineHeight: 1.4, color: theme.textMuted, marginTop: 36 }}>{slide.body}</p>
        ) : null}

        {slide.emphasis ? (
          <div
            style={{
              fontSize: 120,
              marginTop: 24,
              filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.4))",
            }}
          >
            {slide.emphasis}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 64,
            fontSize: 22,
            color: theme.textMuted,
            letterSpacing: 4,
          }}
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC<{ total: number; frame: number }> = ({ total, frame }) => {
  const slideProgress = Math.min(total - 1, Math.floor(frame / SLIDE_FRAMES));
  return (
    <div style={{ position: "absolute", top: 56, left: 56, right: 56, display: "flex", gap: 8 }}>
      {Array.from({ length: total }).map((_, i) => {
        const fill = i < slideProgress ? 1 : i === slideProgress ? (frame % SLIDE_FRAMES) / SLIDE_FRAMES : 0;
        return (
          <div key={i} style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.16)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${fill * 100}%`, height: "100%", background: theme.accent }} />
          </div>
        );
      })}
    </div>
  );
};

const Watermark: React.FC<{ brand: { handle: string; name: string } }> = ({ brand }) => (
  <div
    style={{
      position: "absolute",
      bottom: 64,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      gap: 12,
      alignItems: "center",
      fontSize: 26,
      color: theme.textMuted,
      letterSpacing: 2,
    }}
  >
    <span style={{ fontWeight: 700, color: theme.text }}>{brand.name}</span>
    <span>·</span>
    <span>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 24,
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 18,
      color: "rgba(255,255,255,0.4)",
    }}
  >
    {text}
  </div>
);

const FrameDecor: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    viewBox={`0 0 ${width} ${height}`}
  >
    <rect
      x={32}
      y={32}
      width={width - 64}
      height={height - 64}
      rx={48}
      fill="none"
      stroke="rgba(255,255,255,0.06)"
      strokeWidth={2}
    />
  </svg>
);
