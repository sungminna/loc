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

export const DataStory: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultDataStoryProps.slides;
  const palette = palettes.midnight;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      <Grid />
      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <DataSlide slide={s} index={i} total={list.length} fps={fps} accent={palette.accent} />
        </Sequence>
      ))}

      <Footer brand={brand} attribution={attribution} accent={palette.accent} />
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

      {/* axis-style baseline */}
      <div style={{
        position: "absolute", bottom: 220, left: 96, right: 96,
        height: 1, background: "rgba(255,255,255,0.15)",
      }} />
      <div style={{
        position: "absolute", bottom: 200, left: 96,
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
  const RAD = 250;
  const C = 2 * Math.PI * RAD;

  return (
    <>
      <div style={{
        position: "absolute", top: "26%", left: 96,
        fontSize: 256, fontWeight: 900, lineHeight: 1, color: accent,
        letterSpacing: "-0.04em", fontFeatureSettings: "'tnum'",
        opacity,
      }}>
        {countUp(frame, target, { startFrame: 8, durationFrames: 36, suffix: stat.suffix ?? "", decimals })}
      </div>

      {/* donut ring on right */}
      <svg width="600" height="600" style={{
        position: "absolute", right: 40, top: "22%", opacity: opacity * 0.85,
      }}>
        <circle cx="300" cy="300" r={RAD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        <circle
          cx="300" cy="300" r={RAD} fill="none" stroke={accent} strokeWidth="14"
          strokeDasharray={C} strokeDashoffset={C - C * ringPct * ringT}
          strokeLinecap="round" transform="rotate(-90 300 300)"
        />
      </svg>

      <div style={{
        position: "absolute", top: "60%", left: 96, right: 96,
        fontSize: 32, color: "rgba(255,255,255,0.78)", letterSpacing: 1,
        opacity, maxWidth: 760,
      }}>
        {stat.label ?? ""}
      </div>

      <div style={{
        position: "absolute", top: "70%", left: 96, right: 96,
        fontSize: 60, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em",
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
      position: "absolute", bottom: 96, left: 96, right: 96,
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
        position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
        fontSize: 14, color: "rgba(255,255,255,0.35)",
      }}>{attribution}</div>
    ) : null}
  </>
);
