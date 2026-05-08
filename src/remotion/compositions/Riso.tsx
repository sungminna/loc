// Riso — design references: Toiletpaper Magazine (Maurizio Cattelan),
// Apartamento covers, riso-print zines. Single hot poster color over a
// halftone-treated photograph. Asymmetric type, hand-drawn arrow scribble,
// tape-corner. Reads as printed pop, not a card-news box.
//
// Why this exists: the prior NeoBrutalism + RetroVHS templates were both
// "high-contrast block + glitch" — they collapsed onto each other. This
// replaces them with one tighter idea: a riso-printed poster that has
// the *photograph* doing the work, with type sitting in defined paper
// margin so it never reads on top of the image.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, fitHeadline, fitBody, folioStamp } from "../layout";
import { countUp, easeOutExpo } from "../animations";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.riso;
const FONTS = FONT.Riso!;

export const defaultRisoProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "HOT TAKE", headline: "이건 진짜 큰일", body: "12시간 만에 다 바뀐 한 가지." },
    { kicker: "STAT", headline: "61% 가 모름", stat: { value: "61", suffix: "%", label: "시도 안 함" } },
    { kicker: "POSITION", headline: "방향이 다 였다", body: "결과를 바꾸는 건 노력이 아니라 방향." },
    { kicker: "DO IT", headline: "오늘 1분 안에", body: "1분이면 충분한 한 가지." },
    { kicker: "SAVE", headline: "또 보고 싶다면", emphasis: "🔥" },
  ],
};

export const Riso: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  // Riso uses a heavy display sans (Archivo Black for Latin, Noto Sans
  // KR Black for hangul) — there is no serif on a riso poster.
  const fontSans = FONTS.body;
  const fontSerif = FONTS.display;
  const list = slides.length ? slides : defaultRisoProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.42} /> : null}

      {/* Permanent halftone field, stays under everything */}
      <Halftone />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Poster slide={s} index={i} total={list.length} fps={fps}
                  fontSans={fontSans} fontSerif={fontSerif} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 32, left: 0, right: 0, textAlign: "center",
          fontFamily: fontSans, fontSize: 12, letterSpacing: 3, fontWeight: 700,
          color: "rgba(10,10,10,0.45)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

interface PosterProps {
  slide: ReelSlide; index: number; total: number; fps: number;
  fontSans: string; fontSerif: string; accent: string;
}

const Poster: React.FC<PosterProps> = ({ slide, index, total, fps, fontSans, fontSerif, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 90 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // The photo zone — large rectangle in the upper page, intentionally
  // pushed slightly off-axis. Not centered; this is the riso "thrown" feel.
  const PHOTO_TOP = PAGE.safeTop + 36;
  const PHOTO_HEIGHT = 720;
  const PHOTO_LEFT = PAGE.marginX - 12;
  const PHOTO_W = PAGE.width - PAGE.marginX * 2 + 12;

  // Paper-tear reveal: the image is masked from the bottom up with a
  // slightly jagged inset polygon — feels like printed paper getting
  // peeled back, not a fade-in.
  const tearT = interpolate(enter, [0, 1], [0, 1], { easing: easeOutExpo });
  const tearY = interpolate(tearT, [0, 1], [100, 0]);

  const headlineSize = fitHeadline(slide.headline, {
    max: index === 0 ? 138 : 116, min: 60,
    pivots: index === 0
      ? [[6, 138], [12, 124], [18, 102], [26, 82], [38, 60]]
      : [[6, 116], [12, 104], [18, 88], [26, 72], [38, 60]],
    korean: true,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 32, min: 24 });

  return (
    <AbsoluteFill>
      {/* Photo card — solid hot color rests behind the image so even when
          the image fails to load, the poster still reads. */}
      <div style={{
        position: "absolute", top: PHOTO_TOP, left: PHOTO_LEFT,
        width: PHOTO_W, height: PHOTO_HEIGHT,
        background: accent, overflow: "hidden",
        transform: `rotate(${-1.2 + (index % 2) * 2.4}deg)`,
        boxShadow: `12px 12px 0 ${PALETTE.text}`,
        clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 ${100 - tearY}%)`,
      }}>
        {slide.bgImageUrl ? (
          <Img src={slide.bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            // Riso-strip filter: the image gets pushed to high-contrast
            // grayscale + multiplied with the hot color. Reads as a
            // single-layer riso, not a glossy photograph.
            filter: "grayscale(1) contrast(1.4) brightness(0.95)",
            mixBlendMode: "multiply",
            opacity: 0.92,
          }} />
        ) : null}
        {/* Visible halftone rosette on top of image */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.5) 1px, transparent 1.6px)",
          backgroundSize: "5px 5px",
          mixBlendMode: "multiply",
          opacity: 0.45,
        }} />
      </div>

      {/* Tape corner — top-right, paper artifact */}
      <div style={{
        position: "absolute", top: PHOTO_TOP - 20, right: PHOTO_LEFT + 22,
        width: 120, height: 32, background: "rgba(255,255,255,0.55)",
        border: "1px dashed rgba(10,10,10,0.4)",
        transform: "rotate(8deg)",
        opacity: opacity * 0.9,
      }} />

      {/* Stamp kicker — solid block in the corner of the photo */}
      {slide.kicker ? (
        <div style={{
          position: "absolute", top: PHOTO_TOP + 28, left: PHOTO_LEFT + 24,
          padding: "10px 18px", background: PALETTE.text, color: PALETTE.bg,
          fontFamily: fontSans, fontSize: 22, fontWeight: 900,
          letterSpacing: 5, textTransform: "uppercase",
          transform: `rotate(${-3 + (index % 2) * 6}deg)`,
          opacity, fontFeatureSettings: "'tnum'",
        }}>
          {slide.kicker} · {folioStamp(index, total)}
        </div>
      ) : null}

      {/* Hand-drawn arrow scribble — points from photo to headline */}
      <svg width="280" height="180" style={{
        position: "absolute", top: PHOTO_TOP + PHOTO_HEIGHT - 60, left: PAGE.marginX + 80,
        opacity: opacity * 0.92,
      }}>
        <path
          d="M 20 30 Q 100 100, 220 70 L 200 50 M 220 70 L 196 100"
          stroke={PALETTE.text} strokeWidth="6" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={400}
          strokeDashoffset={interpolate(enter, [0, 1], [400, 0], { easing: easeOutExpo })}
        />
      </svg>

      {/* Headline — Archivo Black display sans, hot ink. Caps for Latin
          (riso poster convention); Korean stays mixed-case since hangul
          has no case to switch. */}
      <h1 style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        bottom: PAGE.safeBottom + 220,
        margin: 0, fontFamily: fontSerif, fontSize: headlineSize,
        fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.015em",
        color: PALETTE.text, opacity,
        transform: `translateY(${(1 - enter) * 28}px)`,
        wordBreak: "keep-all", overflowWrap: "break-word",
        textTransform: /[ㄱ-힝]/.test(slide.headline) ? "none" : "uppercase",
      }}>
        {slide.headline}
      </h1>

      {/* Body or stat — body sits in left column, stat fills lower bar */}
      {slide.stat ? (
        <div style={{
          position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
          bottom: PAGE.safeBottom + 60,
          display: "flex", alignItems: "baseline", gap: 24,
          opacity,
        }}>
          <span style={{
            fontFamily: fontSerif, fontStyle: "italic", fontWeight: 900,
            fontSize: 168, lineHeight: 1, color: accent,
            fontFeatureSettings: "'tnum'", letterSpacing: "-0.05em",
            // Hot ink "wet print" double-stamp effect
            textShadow: `5px 5px 0 ${PALETTE.text}`,
          }}>
            {countUp(frame, Number(slide.stat.value) || 0, {
              startFrame: 8, durationFrames: 30,
              suffix: slide.stat.suffix ?? "",
              decimals: (slide.stat.value ?? "").includes(".") ? 1 : 0,
            })}
          </span>
          {slide.stat.label ? (
            <span style={{
              fontFamily: fontSans, fontSize: 28, fontWeight: 700,
              color: PALETTE.text, lineHeight: 1.2, paddingBottom: 18,
              maxWidth: 380,
            }}>
              {slide.stat.label}
            </span>
          ) : null}
        </div>
      ) : slide.body ? (
        <div style={{
          position: "absolute", left: PAGE.marginX, right: PAGE.marginX + 80,
          bottom: PAGE.safeBottom + 90,
          fontFamily: fontSans, fontSize: bodySize, lineHeight: 1.4,
          color: PALETTE.text, fontWeight: 500, opacity,
          maxWidth: 720,
        }}>
          {slide.body}
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: PAGE.marginX, bottom: PAGE.safeBottom + 70,
          fontSize: 156, lineHeight: 1, opacity,
          transform: `rotate(${-12 + (1 - enter) * -10}deg)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Permanent paper-grain field — tiny dots multiplied across the page so
// the riso stock reads even on the cream margin where there's no photo.
const Halftone: React.FC = () => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    background: "radial-gradient(circle at 1px 1px, rgba(10,10,10,0.18) 1px, transparent 1.4px)",
    backgroundSize: "9px 9px",
    opacity: 0.35,
  }} />
);
