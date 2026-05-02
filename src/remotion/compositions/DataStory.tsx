// DataStory — 인포그래픽 중심 템플릿. 매 슬라이드마다 핵심 stat을 큰 숫자로
// 카운트업 + 도넛/바 차트로 표현. 데이터 저널리즘(Visual Capitalist /
// FT Graphics) 톤. "정보가 있다 → 신뢰감 → 저장" 심리적 동선.
//
// stat이 비어있는 슬라이드는 보통의 헤드라인 카드로 정상 폴백.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { countUp } from "../animations";

const SLIDE_FRAMES = 102;

export const defaultDataStoryProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "FACT", headline: "이 숫자, 진짜야?", stat: { value: "73", suffix: "%", label: "사람이 답을 모름" } },
    { kicker: "GROWTH", headline: "지난 12개월", stat: { value: "4.8", suffix: "x", label: "평균 사용 시간" } },
    { kicker: "GAP", headline: "차이는 더 벌어진다", stat: { value: "1.6", suffix: "M", label: "이미 시작한 사람" } },
    { kicker: "SHIFT", headline: "변하는 균형", body: "수치가 작아도 방향은 분명하다." },
    { kicker: "SAVE", headline: "다음 호에서 더", emphasis: "📊" },
  ],
};

export const DataStory: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultDataStoryProps.slides;
  const palette = palettes.midnight;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font, perspective: "1800px" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      <Grid />
      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <DataSlide slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      <Footer brand={brand} attribution={attribution} accent={accentColor} />
    </AbsoluteFill>
  );
};

const DataSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string }> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 100 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ padding: 80 }}>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.18,
        }} />
      ) : null}

      {/* top label */}
      <div style={{
        position: "absolute", top: 96, left: 96,
        fontSize: 24, letterSpacing: 8, fontWeight: 700, color: accent,
        textTransform: "uppercase", opacity,
      }}>
        ▣ {slide.kicker ?? "DATA"} · CHART {String(index + 1).padStart(2, "0")}
      </div>

      <div style={{
        position: "absolute", top: 96, right: 96,
        fontSize: 22, color: "rgba(255,255,255,0.5)", letterSpacing: 5,
      }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {slide.stat ? (
        <StatHero stat={slide.stat} accent={accent} frame={frame} fps={fps} opacity={opacity} headline={slide.headline} />
      ) : (
        <NarrativeSlide slide={slide} accent={accent} opacity={opacity} enter={enter} />
      )}

      {/* axis-style baseline — sits above the brand footer so it acts like a chart x-axis */}
      <div style={{
        position: "absolute", bottom: 240, left: 96, right: 96,
        height: 1, background: "rgba(255,255,255,0.15)",
      }} />
      <div style={{
        position: "absolute", bottom: 220, left: 96,
        fontSize: 18, color: "rgba(255,255,255,0.45)", letterSpacing: 3,
      }}>
        SOURCE · TRENDING NOW
      </div>
    </AbsoluteFill>
  );
};

const StatHero: React.FC<{
  stat: NonNullable<ReelSlide["stat"]>; accent: string; frame: number; fps: number; opacity: number; headline: string;
}> = ({ stat, accent, frame, fps, opacity, headline }) => {
  const target = Number(stat.value) || 0;
  const decimals = stat.value.includes(".") ? 1 : 0;
  const ringT = spring({ frame: frame - 6, fps, config: { damping: 18, mass: 0.6, stiffness: 80 } });
  const ringPct = Math.min(1, target > 100 ? 1 : target / 100);
  const RAD = 150;
  const C = 2 * Math.PI * RAD;
  // 3D donut entrance — rotates in around Y so the ring "lands" facing camera.
  const donutEnter = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } });
  const donutRy = (1 - donutEnter) * -65;

  return (
    <>
      {/* Compact donut — top-right corner, 360px so it never collides with
          the hero number which now spans full width below it. */}
      <div style={{
        position: "absolute", top: 220, right: 96,
        opacity: opacity * 0.95,
        transform: `perspective(1200px) rotateY(${donutRy}deg)`,
      }}>
        <svg width="360" height="360">
          <circle cx="180" cy="180" r={RAD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle
            cx="180" cy="180" r={RAD} fill="none" stroke={accent} strokeWidth="12"
            strokeDasharray={C} strokeDashoffset={C - C * ringPct * ringT}
            strokeLinecap="round" transform="rotate(-90 180 180)"
          />
        </svg>
      </div>

      {/* Hero number — full-width row, top-aligned just below the kicker. */}
      <div style={{
        position: "absolute", top: 360, left: 96, right: 96,
        fontSize: 280, fontWeight: 900, lineHeight: 1, color: accent,
        letterSpacing: "-0.04em", fontFeatureSettings: "'tnum'",
        opacity,
      }}>
        {countUp(frame, target, { startFrame: 8, durationFrames: 36, suffix: stat.suffix ?? "", decimals })}
      </div>

      {/* Stat label */}
      <div style={{
        position: "absolute", top: 760, left: 96, right: 96,
        fontSize: 32, color: "rgba(255,255,255,0.78)", letterSpacing: 1,
        opacity, maxWidth: 880,
      }}>
        {stat.label ?? ""}
      </div>

      {/* Headline */}
      <div style={{
        position: "absolute", top: 860, left: 96, right: 96,
        fontSize: 64, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em",
        opacity, maxWidth: 920,
      }}>
        {headline}
      </div>
    </>
  );
};

const NarrativeSlide: React.FC<{ slide: ReelSlide; accent: string; opacity: number; enter: number }> = ({ slide, opacity, enter }) => (
  <>
    <div style={{
      position: "absolute", top: "38%", left: 96, right: 96,
      fontSize: 96, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em",
      maxWidth: 880, opacity, transform: `translateY(${(1 - enter) * 30}px)`,
    }}>
      {slide.headline}
    </div>
    {slide.body ? (
      <div style={{
        position: "absolute", top: "62%", left: 96, right: 96,
        fontSize: 36, lineHeight: 1.45, color: "rgba(255,255,255,0.72)",
        maxWidth: 800, opacity,
      }}>
        {slide.body}
      </div>
    ) : null}
    {slide.emphasis ? (
      <div style={{
        position: "absolute", bottom: 320, right: 96,
        fontSize: 140, opacity,
      }}>
        {slide.emphasis}
      </div>
    ) : null}
  </>
);

const Grid: React.FC = () => (
  <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none" }}>
    {Array.from({ length: 24 }).map((_, i) => (
      <line key={i} x1={0} y1={i * 80} x2={1080} y2={i * 80} stroke="white" strokeWidth={1} />
    ))}
  </svg>
);

const Footer: React.FC<{ brand: { handle: string; name: string }; attribution?: string; accent: string }> = ({ brand, attribution, accent }) => (
  <>
    <div style={{
      position: "absolute", bottom: 140, left: 96, right: 96,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 22, letterSpacing: 5, color: "rgba(255,255,255,0.65)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 8, height: 8, background: accent, borderRadius: 4 }} />
        <span style={{ fontWeight: 800, color: "#fff" }}>{brand.name.toUpperCase()}</span>
      </span>
      <span>{brand.handle}</span>
    </div>
    {attribution ? (
      <div style={{
        position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center",
        fontSize: 14, color: "rgba(255,255,255,0.35)",
      }}>{attribution}</div>
    ) : null}
  </>
);
