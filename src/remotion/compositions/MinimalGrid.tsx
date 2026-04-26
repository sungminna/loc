// MinimalGrid — 스위스 그리드 시스템 + 헬베티카 톤. 라인과 여백이 주연.
// 각 슬라이드에 큰 인덱스(01)가 좌측에 들어오고, 측정선/라벨이 함께 그려짐.
// 정보 디자이너 / 어워디드 사이트 톤. 과하지 않으면서 프로다운 느낌.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { maskWipe } from "../animations";

const SLIDE_FRAMES = 90;

export const defaultMinimalGridProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "BRIEF", headline: "오늘의 한 줄", body: "지금 가장 뜨거운 한 가지." },
    { kicker: "WHY", headline: "왜 중요한가", body: "다음 6개월 안에 영향이 보이는 영역." },
    { kicker: "WHAT", headline: "무엇이 바뀌는가", body: "구체적인 변화 한 가지." },
    { kicker: "HOW", headline: "어떻게 대응하나", body: "최소 노력의 첫 걸음." },
    { kicker: "NEXT", headline: "다음 호 예고", body: "이어서 다룰 주제를 미리.", emphasis: "→" },
  ],
};

export const MinimalGrid: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultMinimalGridProps.slides;
  const palette = palettes.ink;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}
      <GridLines />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <MinimalSlide slide={s} index={i} total={list.length} fps={fps} accent={palette.accent} />
        </Sequence>
      ))}

      <Footer brand={brand} attribution={attribution} />
    </AbsoluteFill>
  );
};

const MinimalSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string }> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 100 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  return (
    <AbsoluteFill>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", top: 96, right: 96, width: 720, height: 720,
          objectFit: "cover", opacity: 0.85 * opacity,
          clipPath: maskWipe(frame, 24, "bottom"),
          filter: "grayscale(40%) contrast(1.05)",
        }} />
      ) : null}

      {/* huge index */}
      <div style={{
        position: "absolute", left: 96, top: 240,
        fontSize: 280, fontWeight: 200, lineHeight: 1, color: accent,
        opacity: opacity * 0.95,
        transform: `translateY(${(1 - enter) * 40}px)`,
        fontFeatureSettings: "'tnum'",
      }}>
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* hairline below index */}
      <div style={{
        position: "absolute", left: 96, top: 560,
        height: 2, background: accent,
        width: interpolate(enter, [0, 1], [0, 380]),
      }} />

      {/* category */}
      <div style={{
        position: "absolute", left: 96, top: 600,
        fontSize: 24, letterSpacing: 8, fontWeight: 700, color: "rgba(255,255,255,0.65)",
        textTransform: "uppercase", opacity,
      }}>
        {slide.kicker ?? "ITEM"} — {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* headline */}
      <div style={{
        position: "absolute", left: 96, right: 96, bottom: 480,
        fontSize: 96, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em",
        opacity, transform: `translateY(${(1 - enter) * 30}px)`,
        maxWidth: 880,
      }}>
        {slide.headline}
      </div>

      {slide.body ? (
        <div style={{
          position: "absolute", left: 96, right: 96, bottom: 320,
          fontSize: 38, lineHeight: 1.4, color: "rgba(255,255,255,0.7)",
          maxWidth: 800, opacity,
        }}>
          {slide.body}
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: 96, bottom: 280,
          fontSize: 120, color: accent, opacity,
          transform: `translateX(${interpolate(enter, [0, 1], [-50, 0])}px)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const GridLines: React.FC = () => (
  <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06 }}>
    {[270, 540, 810].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={1920} stroke="white" strokeWidth={1} />)}
    {[480, 960, 1440].map((y) => <line key={y} x1={0} y1={y} x2={1080} y2={y} stroke="white" strokeWidth={1} />)}
  </svg>
);

const Footer: React.FC<{ brand: { handle: string; name: string }; attribution?: string }> = ({ brand, attribution }) => (
  <>
    <div style={{
      position: "absolute", bottom: 80, left: 96, right: 96,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 22, letterSpacing: 5, color: "rgba(255,255,255,0.6)",
    }}>
      <span style={{ fontWeight: 800, color: "#fff" }}>{brand.name.toUpperCase()}</span>
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
