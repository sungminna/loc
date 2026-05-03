// NeoBrutalism — 노란 형광 + 블랙 두꺼운 보더 + 거친 그림자. 카드뉴스 + Web3
// 트렌드의 핵심 룩. 한국 카드뉴스에서 자주 보이는 강렬 대비를 그대로 활용.
//
// 전략: 첫 슬라이드는 비스듬히 회전한 헤드라인 박스 + 형광 배경으로
// 즉시 시선을 강타. 이후 슬라이드는 같은 디자인 언어를 유지하되
// 정보 위주 (stat + bullet)로 정돈.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { countUp } from "../animations";

const SLIDE_FRAMES = 156;

export const defaultNeoBrutalismProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "BREAKING", headline: "이건 진짜 큰일이야", body: "12시간 만에 전 세계가 바뀐 한 가지." },
    { kicker: "STAT", headline: "61%가 모름", body: "당신만 모르고 있을 수도.", stat: { value: "61", suffix: "%", label: "사람이 아직 시도 안 함" } },
    { kicker: "POINT", headline: "핵심은 단 하나", body: "방향을 바꾸지 않으면 결과도 같다." },
    { kicker: "ACTION", headline: "오늘 할 일", body: "1분 안에 끝나는 한 가지부터." },
    { kicker: "SAVE", headline: "이 글 저장해두기", emphasis: "🔥" },
  ],
};

export const NeoBrutalism: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = slides.length ? slides : defaultNeoBrutalismProps.slides;
  const palette = palettes.brutalist;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font, perspective: "1600px" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.45} /> : null}

      {/* checker pattern bg */}
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.07 }}>
        <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="2" fill="black" />
        </pattern>
        <rect width="1080" height="1920" fill="url(#dots)" />
      </svg>

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <BrutalSlide slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      <BrandPill brand={brand} />
      {attribution ? <Attribution text={attribution} /> : null}
    </AbsoluteFill>
  );
};

const BrutalSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string }> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.8, stiffness: 110 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;
  const tilt = (index % 2 === 0 ? -1 : 1) * (index === 0 ? 3 : 1.5);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", top: "12%", left: "12%", width: "76%", height: "30%",
          objectFit: "cover", border: "8px solid black",
          boxShadow: "16px 16px 0 black",
          opacity: 0.95 * opacity,
          transform: `rotate(${tilt * 0.4}deg) scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
        }} />
      ) : null}

      {/* slide counter pill */}
      <div style={{
        position: "absolute", top: 100, left: 80,
        background: "black", color: "white", padding: "12px 22px",
        border: "4px solid black", boxShadow: "6px 6px 0 black",
        fontSize: 24, fontWeight: 900, letterSpacing: 4,
        transform: `rotate(${-tilt * 0.6}deg)`, opacity,
      }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* kicker label */}
      {slide.kicker ? (
        <div style={{
          position: "absolute", top: 100, right: 80,
          background: accent, color: "black", padding: "12px 22px",
          border: "4px solid black", boxShadow: "6px 6px 0 black",
          fontSize: 24, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase",
          transform: `rotate(${tilt * 0.8}deg)`, opacity,
        }}>
          {slide.kicker}
        </div>
      ) : null}

      {/* headline card — stacked box-shadow gives the brutalist depth without
          adding a sibling element that would break flex centering. The 3D
          translateZ pop only kicks in once the card has settled. */}
      <div style={{
        background: "white", color: "black",
        border: "10px solid black",
        boxShadow: `12px 12px 0 ${accent}, 24px 24px 0 black`,
        padding: "60px 56px", maxWidth: 880,
        textAlign: "left",
        transform: `perspective(1400px) rotate(${tilt}deg) rotateX(${(1 - enter) * 18}deg) translateY(${(1 - enter) * 80}px) translateZ(${enter * 30}px)`,
        transformStyle: "preserve-3d",
        opacity,
      }}>
        <h1 style={{
          fontSize: index === 0 ? 110 : 92, fontWeight: 900, lineHeight: 1.0,
          margin: 0, letterSpacing: "-0.02em",
        }}>
          {slide.headline}
        </h1>
        {slide.body ? (
          <p style={{ fontSize: 34, lineHeight: 1.4, marginTop: 32, color: "rgba(0,0,0,0.78)" }}>
            {slide.body}
          </p>
        ) : null}

        {slide.stat ? (
          <div style={{
            marginTop: 36, padding: "20px 28px", background: accent,
            border: "4px solid black", display: "inline-block",
          }}>
            <span style={{ fontSize: 72, fontWeight: 900, fontFeatureSettings: "'tnum'" }}>
              {countUp(frame, Number(slide.stat.value) || 0, { startFrame: 8, durationFrames: 32, suffix: slide.stat.suffix ?? "" })}
            </span>
            {slide.stat.label ? (
              <span style={{ fontSize: 26, marginLeft: 16, fontWeight: 700 }}>{slide.stat.label}</span>
            ) : null}
          </div>
        ) : null}

        {slide.emphasis ? (
          <div style={{ fontSize: 110, marginTop: 24 }}>{slide.emphasis}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const BrandPill: React.FC<{ brand: { handle: string; name: string } }> = ({ brand }) => (
  <div style={{
    position: "absolute", bottom: 140, left: 0, right: 0,
    display: "flex", justifyContent: "center",
  }}>
    <div style={{
      background: "black", color: "white", padding: "16px 32px",
      border: "4px solid black", boxShadow: "8px 8px 0 rgba(0,0,0,0.5)",
      fontSize: 24, fontWeight: 900, letterSpacing: 5,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <span>{brand.name.toUpperCase()}</span>
      <span style={{ width: 6, height: 6, background: "white", borderRadius: 3 }} />
      <span style={{ opacity: 0.75 }}>{brand.handle}</span>
    </div>
  </div>
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center",
    fontSize: 14, color: "rgba(0,0,0,0.6)",
  }}>{text}</div>
);
