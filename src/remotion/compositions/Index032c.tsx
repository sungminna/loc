// Index — design references: Wallpaper*, 032c, Index Magazine. Black
// field with a single huge sans display word, a chartreuse-yellow
// accented numeric index, ticker rules running margin-to-margin top and
// bottom. Intentionally hard, gridded, "frontier-press" feel.
//
// Why this exists: the prior KineticType composition treated typography
// as confetti — words bounced in pun-by-word, which read as motion-
// graphics demo, not magazine. Here the type sits like printed lead and
// the *grid* is the move: tickers, ranking number, frame, snap-cuts.
//
// Best for AI/tech, frontier reporting, or single-keyword openers.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, fitHeadline, fitBody, folioStamp } from "../layout";
import { countUp, easeOutExpo, marquee } from "../animations";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.index;
const FONTS = FONT.Index032c!;

export const defaultIndex032cProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "INDEX", headline: "FRONTIER", body: "이번 주 가장 가파르게 움직인 한 가지." },
    { kicker: "DATA", headline: "GROWTH", stat: { value: "4.8", suffix: "x", label: "12개월 사용 시간 증가" } },
    { kicker: "POSITION", headline: "REWRITE", body: "익숙했던 기준이 더는 통하지 않는 영역." },
    { kicker: "ACTION", headline: "RUN IT", body: "1분이면 되는 한 가지." },
    { kicker: "OUTRO", headline: "NEXT", emphasis: "→" },
  ],
};

export const Index032c: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  // 032c / Wallpaper* run almost entirely on a single neutral grotesque
  // (Helvetica derivative). Inter Black is the closest free analog;
  // Korean falls to Noto Sans KR Black.
  const fontSans = FONTS.body;
  const fontMono = FONTS.mono;
  const list = slides.length ? slides : defaultIndex032cProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.4} /> : null}

      <TopTicker fontMono={fontMono} accent={accentColor} totalSlides={list.length} />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Spread slide={s} index={i} total={list.length} fps={fps}
                  fontSans={fontSans} fontMono={fontMono} accent={accentColor} />
        </Sequence>
      ))}

      <BottomTicker fontMono={fontMono} attribution={attribution} />
    </AbsoluteFill>
  );
};

interface SpreadProps {
  slide: ReelSlide; index: number; total: number; fps: number;
  fontSans: string; fontMono: string; accent: string;
}

const Spread: React.FC<SpreadProps> = ({ slide, index, total, fps, fontSans, fontMono, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 100 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // Snap-cut behavior — the slide settles in 8 frames flat, no spring
  // bounce. Frontier-press, not Apple keynote. We only fade the opacity.
  const snap = interpolate(frame, [0, 6, SLIDE_FRAMES - 8, SLIDE_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Headlines render in uppercase sans display — even at the same point
  // size, latin caps are wider than mixed-case so we cap below the prior
  // 224 ceiling. Single-word display tops at 156, two-word at 124.
  const headlineSize = fitHeadline(slide.headline, {
    max: 156, min: 64,
    pivots: [[4, 156], [8, 132], [12, 108], [18, 88], [28, 72], [40, 64]],
    korean: /[ㄱ-힝]/.test(slide.headline),
  });
  const bodySize = fitBody(slide.body ?? "", { max: 28, min: 22 });

  // Image lives in the upper-right rectangle. When the panel is empty
  // (no slide.bgImageUrl) we DON'T fill it with accent — that read as a
  // giant chartreuse block in review. Instead the panel becomes a thin-
  // bordered "no image filed" zone — gridded but quiet, the way a press
  // proof page leaves an unprinted plate.
  const PANEL_TOP = PAGE.safeTop + 80;
  const PANEL_W = 360;
  const PANEL_H = 460;
  const PANEL_RIGHT = PAGE.marginX;

  return (
    <AbsoluteFill style={{ opacity: snap }}>
      {/* Image panel — bordered, hard-edged, top-right. Empty state is
          a quiet press-proof rectangle (subtle stripes on surface), not
          a saturated accent block. */}
      <div style={{
        position: "absolute", top: PANEL_TOP, right: PANEL_RIGHT,
        width: PANEL_W, height: PANEL_H,
        border: `2px solid ${slide.bgImageUrl ? PALETTE.text : PALETTE.rule}`,
        background: PALETTE.surface,
        overflow: "hidden",
      }}>
        {slide.bgImageUrl ? (
          <Img src={slide.bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: "grayscale(0.4) contrast(1.05)",
            transform: `scale(${interpolate(frame, [0, SLIDE_FRAMES + 12], [1, 1.03])})`,
          }} />
        ) : (
          <>
            <div style={{
              position: "absolute", inset: 0,
              background: `repeating-linear-gradient(45deg, transparent 0 24px, ${PALETTE.rule} 24px 25px)`,
              opacity: 0.6,
            }} />
            <div style={{
              position: "absolute", left: 16, top: 14,
              fontFamily: fontMono, fontSize: 11, letterSpacing: 4, fontWeight: 700,
              color: PALETTE.textMuted, textTransform: "uppercase",
            }}>
              PLATE / OPEN
            </div>
          </>
        )}
        {/* Frame number sticker on the panel's bottom-right corner */}
        <div style={{
          position: "absolute", right: 0, bottom: 0,
          padding: "6px 12px", background: PALETTE.text, color: PALETTE.bg,
          fontFamily: fontMono, fontSize: 14, letterSpacing: 2, fontWeight: 700,
          fontFeatureSettings: "'tnum'",
        }}>
          {folioStamp(index, total)}
        </div>
      </div>

      {/* Big indexed numeral — chartreuse, top-left, sized so it never
          collides with the right-side image panel (panel starts at
          x = 1080 - 96 - 360 = 624; numeral ends at ~96 + 380 = 476). */}
      <div style={{
        position: "absolute", left: PAGE.marginX, top: PANEL_TOP - 6,
        fontFamily: fontSans, fontSize: 220, fontWeight: 900, lineHeight: 0.85,
        color: accent, fontFeatureSettings: "'tnum'",
        letterSpacing: "-0.06em",
        opacity: opacity * 0.96,
        transform: `translateX(${(1 - enter) * -40}px)`,
      }}>
        №{String(index + 1).padStart(2, "0")}
      </div>

      {/* Section line under the numeral */}
      <div style={{
        position: "absolute", left: PAGE.marginX, top: PANEL_TOP + 200,
        height: 4, background: accent,
        width: interpolate(enter, [0, 1], [0, 380], { easing: easeOutExpo }),
      }} />

      {/* Kicker band */}
      <div style={{
        position: "absolute", left: PAGE.marginX, top: PANEL_TOP + 218,
        fontFamily: fontMono, fontSize: 18, letterSpacing: 6, fontWeight: 700,
        color: PALETTE.textMuted, textTransform: "uppercase",
        opacity, fontFeatureSettings: "'tnum'",
      }}>
        {slide.kicker ?? "INDEX"} / {String(index + 1).padStart(2, "0")} OF {String(total).padStart(2, "0")}
      </div>

      {/* Headline — sans display word, anchored to the bottom of the
          column. Single-line whenever possible. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        bottom: PAGE.safeBottom + 220,
        fontFamily: fontSans, fontSize: headlineSize,
        fontWeight: 900, lineHeight: 0.94, letterSpacing: "-0.04em",
        color: PALETTE.text, opacity,
        textTransform: "uppercase",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}>
        {slide.headline}
      </div>

      {/* Stat panel (when present) — sits below headline, mono */}
      {slide.stat ? (
        <div style={{
          position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
          bottom: PAGE.safeBottom + 60,
          display: "flex", alignItems: "baseline", gap: 22,
          opacity, fontFeatureSettings: "'tnum'",
        }}>
          <span style={{
            fontFamily: fontSans, fontSize: 124, fontWeight: 900,
            color: accent, lineHeight: 1, letterSpacing: "-0.04em",
          }}>
            {countUp(frame, Number(slide.stat.value) || 0, {
              startFrame: 8, durationFrames: 26,
              suffix: slide.stat.suffix ?? "",
              decimals: (slide.stat.value ?? "").includes(".") ? 1 : 0,
            })}
          </span>
          {slide.stat.label ? (
            <span style={{
              fontFamily: fontMono, fontSize: 22, fontWeight: 700,
              color: PALETTE.textMuted, paddingBottom: 14,
              letterSpacing: 3, textTransform: "uppercase",
            }}>
              {slide.stat.label}
            </span>
          ) : null}
        </div>
      ) : slide.body ? (
        <div style={{
          position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
          bottom: PAGE.safeBottom + 90,
          fontFamily: fontMono, fontSize: bodySize, lineHeight: 1.45,
          color: PALETTE.textMuted, opacity, maxWidth: 720,
        }}>
          {slide.body}
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: PAGE.marginX, bottom: PAGE.safeBottom + 50,
          fontSize: 130, color: accent, lineHeight: 1, opacity,
        }}>
          {slide.emphasis}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const TopTicker: React.FC<{ fontMono: string; accent: string; totalSlides: number }> = ({ fontMono, accent, totalSlides }) => {
  const frame = useCurrentFrame();
  // A scrolling marquee row at the top — keeps the page alive without
  // touching slide content. Length is tuned to loop cleanly per slide.
  const text = `INDEX × ${totalSlides} / FRONTIER 2026 / SEOUL · NEW YORK · TOKYO / `;
  const tx = marquee(frame, 1080, 540);
  return (
    <div style={{
      position: "absolute", top: PAGE.safeTop - 60, left: 0, right: 0,
      height: 36, overflow: "hidden",
      background: PALETTE.surface, color: accent,
      fontFamily: fontMono, fontSize: 14, letterSpacing: 6, fontWeight: 700,
      borderTop: `1px solid ${PALETTE.rule}`,
      borderBottom: `1px solid ${PALETTE.rule}`,
      display: "flex", alignItems: "center",
      whiteSpace: "nowrap",
    }}>
      <div style={{ transform: `translateX(${tx}px)` }}>
        {text.repeat(8)}
      </div>
    </div>
  );
};

const BottomTicker: React.FC<{ fontMono: string; attribution?: string }> = ({ fontMono, attribution }) => (
  <div style={{
    position: "absolute", bottom: PAGE.safeBottom - 80, left: PAGE.marginX, right: PAGE.marginX,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontFamily: fontMono, fontSize: 14, letterSpacing: 4, fontWeight: 700,
    color: PALETTES.index.textMuted, textTransform: "uppercase",
    fontFeatureSettings: "'tnum'",
  }}>
    <span>FILED · 2026.05</span>
    {attribution ? <span>{attribution}</span> : null}
  </div>
);
