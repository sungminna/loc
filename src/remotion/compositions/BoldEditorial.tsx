// BoldEditorial — 잡지/에디토리얼 디자인. 세리프 헤드라인 + 사이드 컬럼 +
// 챕터 마커. New York Times Magazine / It's Nice That 톤.
//
// 시선 전략: 첫 슬라이드는 거대한 세리프 + 가는 산세리프로 대비를 만들고,
// 두 번째부터는 사이드바에 카운터(01, 02…)와 카테고리 라벨이 슬라이드한다.
// 너무 자극적이지 않게, 신뢰감 있는 톤으로 retention을 잡는 컨셉.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { kenBurns, maskWipe } from "../animations";

const SLIDE_FRAMES = 102;

export const defaultBoldEditorialProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "ISSUE 01", headline: "다시 쓰는\n오늘의 규칙", body: "왜 지금 우리는 다른 답을 찾아야 하는가." },
    { kicker: "PERSPECTIVE", headline: "변하는 것", body: "노동 · 도시 · 관계의 정의가 흔들리는 중." },
    { kicker: "PERSPECTIVE", headline: "그대로인 것", body: "여전히 작동하는 인간적 기본기들." },
    { kicker: "ACTION", headline: "이번 주의 시도", body: "단순히 알지 말고, 한 가지를 직접 해 본다." },
    { kicker: "CLOSING", headline: "기록할 것", body: "다음 호에서 이어서 다룹니다.", emphasis: "✱" },
  ],
};

export const BoldEditorial: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const fontSerif = theme.fontFamilySerif;
  const fontSans = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultBoldEditorialProps.slides;
  const palette = palettes.paper;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, perspective: "1800px" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.35} /> : null}

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <EditorialSlide slide={s} index={i} total={list.length} fps={fps} fontSerif={fontSerif} fontSans={fontSans} accent={accentColor} brand={brand} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
          fontFamily: fontSans, fontSize: 16, color: "rgba(0,0,0,0.4)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

interface SlideProps {
  slide: ReelSlide; index: number; total: number; fps: number;
  fontSerif: string; fontSans: string; accent: string;
  brand: { handle: string; name: string };
}

const EditorialSlide: React.FC<SlideProps> = ({ slide, index, total, fps, fontSerif, fontSans, accent, brand }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7, stiffness: 90 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;
  const headlineLines = slide.headline.split("\n");
  // 3D side-panel — image swings in from rotateY when present.
  const panelRy = (1 - enter) * 22;
  const panelTz = (1 - enter) * -160;

  return (
    <AbsoluteFill>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", top: 0, right: 0, width: "60%", height: "100%",
          objectFit: "cover", opacity: 0.92,
          clipPath: maskWipe(frame, 22, "left"),
          transform: `${kenBurns(frame, SLIDE_FRAMES, "out")} translateZ(${panelTz}px) rotateY(${-panelRy}deg)`,
          transformOrigin: "right center",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.18)",
        }} />
      ) : null}

      {/* hairline rule across the top */}
      <div style={{ position: "absolute", top: 96, left: 96, right: 96, height: 1, background: "rgba(0,0,0,0.4)" }} />
      <div style={{
        position: "absolute", top: 64, left: 96, fontFamily: fontSans,
        fontSize: 20, fontWeight: 800, letterSpacing: 8, color: accent,
      }}>
        {brand.name.toUpperCase()} · {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* sidebar with kicker */}
      <div style={{
        position: "absolute", left: 96, top: "30%",
        opacity, transform: `translateX(${(1 - enter) * -30}px)`,
      }}>
        <div style={{
          fontFamily: fontSans, fontSize: 22, fontWeight: 700, letterSpacing: 6,
          color: "rgba(0,0,0,0.55)", textTransform: "uppercase",
        }}>
          {slide.kicker ?? "Story"}
        </div>
        <div style={{ width: 64, height: 4, background: accent, marginTop: 22 }} />
      </div>

      {/* headline */}
      <div style={{
        position: "absolute", left: 96, right: 96, top: "36%",
        fontFamily: fontSerif, fontSize: index === 0 ? 152 : 122,
        fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.02em",
        opacity, transform: `translateY(${(1 - enter) * 40}px)`,
      }}>
        {headlineLines.map((line, i) => (
          <div key={i} style={{ overflow: "hidden" }}>
            <div style={{
              transform: `translateY(${(1 - spring({ frame: frame - i * 6, fps, config: { damping: 18 } })) * 100}%)`,
            }}>
              {line}
            </div>
          </div>
        ))}
      </div>

      {/* body — pinned above the footer rule (which sits at bottom 200) */}
      {slide.body ? (
        <div style={{
          position: "absolute", left: 96, right: 96, bottom: 320,
          fontFamily: fontSans, fontSize: 38, lineHeight: 1.45, color: "rgba(0,0,0,0.7)",
          maxWidth: 760, opacity, transform: `translateY(${(1 - enter) * 20}px)`,
        }}>
          {slide.body}
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: 120, bottom: 260,
          fontFamily: fontSerif, fontSize: 180, color: accent, opacity: opacity * 0.9,
          transform: `rotate(${interpolate(enter, [0, 1], [-20, 0])}deg)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}

      {/* footer rule sits above the brand block (Reels safe area at 140) */}
      <div style={{ position: "absolute", bottom: 200, left: 96, right: 96, height: 1, background: "rgba(0,0,0,0.4)" }} />
      <div style={{
        position: "absolute", bottom: 150, left: 96, right: 96,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: fontSans, fontSize: 18, color: "rgba(0,0,0,0.6)", letterSpacing: 3,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, background: accent, borderRadius: 3 }} />
          {brand.handle}
        </span>
        <span>FOLIO {String(index + 1).padStart(3, "0")}</span>
      </div>
    </AbsoluteFill>
  );
};
