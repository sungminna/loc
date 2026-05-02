// QuoteSpotlight — 큰 인용문 + 출처. Pinterest / Goodreads 톤. 한 슬라이드
// 한 인용문 (또는 한 통찰)으로 강한 retention. 인용문 박스 좌우에 큰 따옴표
// 글리프, 하단에 출처(attribution) 카드.
//
// 정보 밀도가 낮은 대신 감정에 호소 — 깊이 있는 콘텐츠나 어록 콘텐츠 전용.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { kenBurns, splitTextProgress } from "../animations";

const SLIDE_FRAMES = 108;

export const defaultQuoteSpotlightProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "QUOTE 01", headline: "결국 남는 건 우리가 보낸 시간이다.", attribution: "익명의 편지" },
    { kicker: "QUOTE 02", headline: "확실하지 않은 채로도 시작할 수 있다.", attribution: "어떤 작가" },
    { kicker: "QUOTE 03", headline: "느린 진전은 진전이 아닌 게 아니다.", attribution: "어떤 일기장" },
    { kicker: "OUTRO", headline: "오늘 한 줄, 적어 보기.", emphasis: "✍️" },
  ],
};

export const QuoteSpotlight: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const serif = theme.fontFamilySerif;
  const list = slides.length ? slides : defaultQuoteSpotlightProps.slides;
  const palette = palettes.sunrise;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <QuoteSlide slide={s} index={i} total={list.length} fps={fps} accent={accentColor} serif={serif} sans={font} />
        </Sequence>
      ))}

      <FloatingBrand brand={brand} sans={font} accent={accentColor} />
      {attribution ? <Attribution text={attribution} sans={font} /> : null}
    </AbsoluteFill>
  );
};

const QuoteSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string; serif: string; sans: string }> = ({ slide, index, total, fps, accent, serif, sans }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7, stiffness: 80 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;
  const words = slide.headline.split(/\s+/);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.55, transform: kenBurns(frame, SLIDE_FRAMES, "in"),
          filter: "saturate(1.2) blur(1px)",
          mixBlendMode: "multiply",
        }} />
      ) : null}

      {/* huge opening quote glyph */}
      <div style={{
        position: "absolute", top: 220, left: 96,
        fontFamily: serif, fontSize: 360, fontWeight: 900,
        color: accent, lineHeight: 1, opacity: opacity * 0.9,
        transform: `translateY(${(1 - enter) * 60}px)`,
      }}>
        “
      </div>

      {/* index */}
      <div style={{
        position: "absolute", top: 96, right: 96,
        fontSize: 22, fontWeight: 800, letterSpacing: 8, color: "rgba(26,16,20,0.55)",
      }}>
        {slide.kicker ?? `QUOTE ${String(index + 1).padStart(2, "0")}`} · {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* quote text */}
      <div style={{
        textAlign: "left", maxWidth: 900,
        position: "absolute", left: 96, right: 96, top: "32%",
        fontFamily: serif, fontSize: 96, fontWeight: 900,
        lineHeight: 1.15, letterSpacing: "-0.01em",
        color: "#1a1014",
      }}>
        {words.map((w, i) => {
          const t = splitTextProgress(frame, fps, i, { startFrame: 12, perItemFrames: 4, durationFrames: 18 });
          return (
            <span key={i} style={{
              display: "inline-block", marginRight: 18,
              opacity: t,
              transform: `translateY(${(1 - t) * 28}px)`,
            }}>
              {w}
            </span>
          );
        })}
      </div>

      {slide.emphasis ? (
        <div style={{
          position: "absolute", bottom: 400, right: 96, fontSize: 160,
          opacity, transform: `rotate(${-8 + interpolate(enter, [0, 1], [-12, 0])}deg)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}

      {slide.attribution ? (
        <div style={{
          position: "absolute", bottom: 280, left: 96,
          opacity, transform: `translateX(${(1 - enter) * -30}px)`,
        }}>
          <div style={{ width: 80, height: 3, background: accent, marginBottom: 22 }} />
          <div style={{ fontFamily: sans, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
            — {slide.attribution}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const FloatingBrand: React.FC<{ brand: { handle: string; name: string }; sans: string; accent: string }> = ({ brand, sans, accent }) => (
  <div style={{
    position: "absolute", bottom: 140, left: 0, right: 0,
    display: "flex", justifyContent: "center", gap: 14, alignItems: "center",
    fontFamily: sans, fontSize: 22, color: "rgba(26,16,20,0.7)", letterSpacing: 3,
  }}>
    <span style={{ width: 6, height: 6, background: accent, borderRadius: 3 }} />
    <span style={{ fontWeight: 800, color: "#1a1014" }}>{brand.name.toUpperCase()}</span>
    <span>·</span>
    <span>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string; sans: string }> = ({ text, sans }) => (
  <div style={{
    position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
    fontFamily: sans, fontSize: 14, color: "rgba(26,16,20,0.5)",
  }}>{text}</div>
);
