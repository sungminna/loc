// RetroVHS — Y2K / VHS / 시티팝 톤. 색수차 + 스캔라인 + 픽셀 글리치.
// 첫 슬라이드는 글리치 인트로로 강하게 시선을 끌고, 본문은 모노스페이스 폰트
// + 분홍 형광으로 '비밀스러운 카세트 테이프' 분위기. Letterboxd / 2024
// 레트로 웨이브 트렌드 반영.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { palettes, theme } from "../theme";
import { chromaShadow, grainPulse, pseudoRandom } from "../animations";

const SLIDE_FRAMES = 156;

export const defaultRetroVHSProps: CardSlideProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  slides: [
    { kicker: "REC ●", headline: "TAPE 01", body: "여기서부터 모르면 큰일납니다." },
    { kicker: "SIDE A", headline: "잊혀진 한 마디", body: "20년 전엔 흔했지만 지금은 사치가 된 것." },
    { kicker: "SIDE B", headline: "다시 돌아온 이유", body: "결국 사람은 손에 잡히는 것을 좋아한다." },
    { kicker: "PLAY ▶", headline: "이번 주 시도", body: "디지털 한 가지를 종이로 옮기기." },
    { kicker: "EOS", headline: "End of Side", emphasis: "📼" },
  ],
};

export const RetroVHS: React.FC<CardSlideProps> = ({ brand, lang, slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const font = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const mono = theme.fontFamilyMono;
  const list = slides.length ? slides : defaultRetroVHSProps.slides;
  const palette = palettes.vhs;
  const accentColor = accent ?? palette.accent;

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: font, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.45} /> : null}

      <CRTBackground accent={accentColor} />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <VHSSlide slide={s} index={i} total={list.length} fps={fps} accent={accentColor} mono={mono} />
        </Sequence>
      ))}

      <ScanLines />
      <BrandHud brand={brand} mono={mono} accent={accentColor} />
      {attribution ? <Attribution text={attribution} mono={mono} /> : null}
    </AbsoluteFill>
  );
};

const CRTBackground: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, ${accent}2e 0%, transparent 70%)`,
        opacity: grainPulse(frame, 0.85, 0.1, 24),
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 70% 30%, rgba(0,180,255,0.22), transparent 50%)",
      }} />
    </>
  );
};

const VHSSlide: React.FC<{ slide: ReelSlide; index: number; total: number; fps: number; accent: string; mono: string }> = ({ slide, index, total, fps, accent, mono }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 110 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // Glitch jitter every ~6 frames for the first 24 frames. Math.random()
  // is non-deterministic per render call which made server renders diverge
  // from previews — use a frame-seeded pseudo-random instead.
  const glitchActive = frame < 24 && frame % 6 === 0;
  const jitter = glitchActive ? (pseudoRandom(frame, index + 1) - 0.5) * 14 : 0;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      {slide.bgImageUrl ? (
        <Img src={slide.bgImageUrl} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.4 * opacity,
          filter: "saturate(1.5) hue-rotate(330deg) contrast(1.1)",
        }} />
      ) : null}

      {/* Top HUD */}
      <div style={{
        position: "absolute", top: 80, left: 80, right: 80,
        display: "flex", justifyContent: "space-between",
        fontFamily: mono, fontSize: 22, color: accent, letterSpacing: 4,
        textShadow: chromaShadow(2),
      }}>
        <span>● {slide.kicker ?? "REC"}</span>
        <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      </div>

      {/* Headline */}
      <div style={{
        textAlign: "center", maxWidth: 880,
        opacity, transform: `translateX(${jitter}px) translateY(${(1 - enter) * 30}px)`,
      }}>
        <h1 style={{
          fontSize: index === 0 ? 138 : 110, fontWeight: 900, lineHeight: 1.0,
          margin: 0, letterSpacing: "-0.02em",
          textShadow: chromaShadow(index === 0 ? 6 : 4),
          color: "#f8e9ff",
        }}>
          {slide.headline}
        </h1>
        {slide.body ? (
          <div style={{
            fontFamily: mono, fontSize: 30, color: "rgba(248,233,255,0.78)",
            marginTop: 36, lineHeight: 1.5,
          }}>
            {slide.body}
          </div>
        ) : null}
        {slide.emphasis ? (
          <div style={{ fontSize: 140, marginTop: 32 }}>{slide.emphasis}</div>
        ) : null}
      </div>

      {/* Bottom timecode */}
      <div style={{
        position: "absolute", bottom: 200, left: 80,
        fontFamily: mono, fontSize: 22, color: accent, letterSpacing: 3,
      }}>
        {timecode(frame)}
      </div>
      <div style={{
        position: "absolute", bottom: 200, right: 80,
        fontFamily: mono, fontSize: 22, color: "rgba(248,233,255,0.55)", letterSpacing: 3,
      }}>
        SP · STEREO · NTSC
      </div>
    </AbsoluteFill>
  );
};

function timecode(frame: number): string {
  const sec = Math.floor(frame / 30);
  const ff = (frame % 30).toString().padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  return `${mm}:${ss}:${ff}`;
}

const ScanLines: React.FC = () => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 2px, transparent 2px, transparent 5px)",
    mixBlendMode: "multiply", opacity: 0.32,
  }} />
);

const BrandHud: React.FC<{ brand: { handle: string; name: string }; mono: string; accent: string }> = ({ brand, mono, accent }) => (
  <div style={{
    position: "absolute", bottom: 140, left: 80, right: 80,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontFamily: mono, fontSize: 20, letterSpacing: 5, color: "rgba(248,233,255,0.8)",
  }}>
    <span style={{ color: accent, fontWeight: 700 }}>{brand.name.toUpperCase()}</span>
    <span>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string; mono: string }> = ({ text, mono }) => (
  <div style={{
    position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
    fontFamily: mono, fontSize: 14, color: "rgba(248,233,255,0.4)",
  }}>{text}</div>
);
