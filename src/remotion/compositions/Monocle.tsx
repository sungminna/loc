// Monocle — design references: Monocle (Tyler Brûlé), Bloomberg
// Businessweek, FT Weekend. Briefing layout: hairline mast at top with
// city + section, oversized index numeral on the left, two-column body,
// large stat block at the foot. Restrained navy field, single oxblood
// accent. Reads as printed press, not a slide.
//
// Why this exists: the prior DataStory + MinimalGrid templates were both
// "minimalist sans on a dark gradient" — they collapsed into one design.
// This replaces both with a single more disciplined idea: every slide is
// a Monocle briefing column.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, fitHeadline, fitBody, folioStamp } from "../layout";
import { countUp, easeOutExpo } from "../animations";

const SLIDE_FRAMES = 162;
const PALETTE = PALETTES.monocle;
const FONTS = FONT.Monocle!;

export const defaultMonocleProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "BRIEFING", headline: "지난주의 신호", body: "수치로 잡히는 첫 변화 한 가지." },
    { kicker: "DATA", headline: "73% 가 모름", stat: { value: "73", suffix: "%", label: "실제로 시도한 적 없음" }, body: "조사 응답자 1,204명. 2026.04 기준." },
    { kicker: "POSITION", headline: "그래서 무엇이 바뀌나", body: "기관 자금이 4.8배 들어왔다. 같은 분기 외국인은 매도. 동시에 일어난 건 2020년 이후 처음." },
    { kicker: "ACTION", headline: "이번 주 시도", body: "1분 안에 끝나는 한 가지." },
    { kicker: "OUTRO", headline: "다음 호 예고", emphasis: "→" },
  ],
};

export const Monocle: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  // Monocle's headline is set in Plantin (the serif). The kicker /
  // dateline / agate stay in Helvetica equivalent (sans). This is the
  // signature serif-headline / sans-furniture pairing the publication
  // has run since 2007.
  const fontSans = FONTS.body;
  const fontSerif = FONTS.display;
  const list = slides.length ? slides : defaultMonocleProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      <PressMast fontSans={fontSans} accent={accentColor} />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Brief slide={s} index={i} total={list.length} fps={fps}
                 fontSans={fontSans} fontSerif={fontSerif} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 36, left: 0, right: 0, textAlign: "center",
          fontFamily: fontSans, fontSize: 14, letterSpacing: 2,
          color: "rgba(241,236,226,0.40)", fontFeatureSettings: "'tnum'",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

interface BriefProps {
  slide: ReelSlide; index: number; total: number; fps: number;
  fontSans: string; fontSerif: string; accent: string;
}

const Brief: React.FC<BriefProps> = ({ slide, index, total, fps, fontSans, fontSerif, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 90 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // The press strip — image lives at the top third only. Below it, type.
  const STRIP_TOP = PAGE.safeTop + 24;
  const STRIP_HEIGHT = 600;
  const TYPE_TOP = STRIP_TOP + STRIP_HEIGHT + 56;

  const headlineSize = fitHeadline(slide.headline, {
    max: 102, min: 56,
    pivots: [[6, 102], [12, 92], [20, 76], [30, 60], [40, 56]],
    korean: true,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 30, min: 22 });

  // Hairline draw across — common Monocle move. Two ticks anchor the
  // headline above and below.
  const ruleWidth = interpolate(enter, [0, 1], [0, PAGE.width - PAGE.marginX * 2], {
    easing: easeOutExpo,
  });

  // Stat: count-up + ledger-bar wipe. Stat block sits at lower-third.
  const statBarT = interpolate(frame, [12, 50], [0, 1], { extrapolateRight: "clamp", easing: easeOutExpo });
  const statTarget = Number(slide.stat?.value ?? 0);
  const statDecimals = (slide.stat?.value ?? "").includes(".") ? 1 : 0;

  return (
    <AbsoluteFill>
      {/* Press image strip — single horizontal band, full bleed of margin.
          Image gets its zone; text never sits on top of it. */}
      <div style={{
        position: "absolute", top: STRIP_TOP,
        left: PAGE.marginX, right: PAGE.marginX, height: STRIP_HEIGHT,
        background: PALETTE.surface, overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      }}>
        {slide.bgImageUrl ? (
          <Img src={slide.bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: "saturate(0.85) brightness(0.92)",
            transform: `scale(${interpolate(frame, [0, SLIDE_FRAMES + 12], [1, 1.04])})`,
          }} />
        ) : (
          // Empty-state: a darker navy with a faint vertical hairline
          // grid — reads as a press-proof plate, not a missing image.
          <>
            <div style={{
              width: "100%", height: "100%",
              background: `linear-gradient(135deg, ${PALETTE.surface} 0%, #182838 100%)`,
            }} />
            <div style={{
              position: "absolute", inset: 0,
              background: `repeating-linear-gradient(90deg, transparent 0 80px, ${PALETTE.rule} 80px 81px)`,
              opacity: 0.5,
            }} />
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 40%, rgba(216,83,74,0.08) 0%, transparent 60%)",
            }} />
          </>
        )}
        {/* Caption block on the image — Monocle credits images this way */}
        <div style={{
          position: "absolute", left: 18, bottom: 14, padding: "8px 14px",
          background: PALETTE.bg, color: PALETTE.text,
          fontFamily: fontSans, fontSize: 14, fontWeight: 700,
          letterSpacing: 4, textTransform: "uppercase",
        }}>
          {slide.kicker ?? "BRIEF"} <span style={{ color: accent, marginLeft: 8 }}>—</span>{" "}
          <span style={{ fontFeatureSettings: "'tnum'" }}>{folioStamp(index, total)}</span>
        </div>
      </div>

      {/* Hairline rule above the headline */}
      <div style={{
        position: "absolute", top: TYPE_TOP - 24,
        left: PAGE.marginX, width: ruleWidth, height: 1, background: PALETTE.rule,
      }} />

      {/* Oversized index numeral — left-anchored, light weight */}
      <div style={{
        position: "absolute", top: TYPE_TOP - 26, right: PAGE.marginX,
        fontFamily: fontSerif, fontSize: 96, fontWeight: 200, lineHeight: 1,
        color: accent, fontFeatureSettings: "'tnum'", opacity,
      }}>
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Headline — Plantin-style serif, oversized weight. This is the
          signature Monocle move: serif headline above sans furniture. */}
      <div style={{
        position: "absolute", top: TYPE_TOP, left: PAGE.marginX, right: PAGE.marginX + 140,
        fontFamily: fontSerif, fontSize: headlineSize, fontWeight: 900,
        lineHeight: 1.02, letterSpacing: "-0.015em", color: PALETTE.text,
        opacity, transform: `translateY(${(1 - enter) * 24}px)`,
        wordBreak: "keep-all", overflowWrap: "break-word",
      }}>
        {slide.headline}
      </div>

      {/* Stat ledger bar — full-width two-column row when stat present.
          Bar wipes left-to-right; the count-up is locked to tnum. */}
      {slide.stat ? (
        <div style={{
          position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
          bottom: PAGE.safeBottom + 100,
          display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 32,
          alignItems: "end", opacity,
        }}>
          <div>
            <div style={{
              fontFamily: fontSans, fontSize: 14, fontWeight: 700,
              letterSpacing: 5, color: PALETTE.textMuted, textTransform: "uppercase",
            }}>
              {slide.stat.label ?? "VALUE"}
            </div>
            <div style={{
              fontFamily: fontSans, fontWeight: 900, lineHeight: 1,
              fontSize: 188, color: PALETTE.text,
              fontFeatureSettings: "'tnum'", marginTop: 14,
              letterSpacing: "-0.04em",
            }}>
              {countUp(frame, statTarget, {
                startFrame: 12, durationFrames: 36,
                suffix: slide.stat.suffix ?? "", decimals: statDecimals,
              })}
            </div>
          </div>
          {slide.body ? (
            <div style={{
              fontFamily: fontSans, fontSize: bodySize, lineHeight: 1.45,
              color: PALETTE.textMuted, paddingBottom: 20,
            }}>
              {slide.body}
            </div>
          ) : null}
          {/* The ledger bar at the very bottom of this row */}
          <div style={{
            gridColumn: "1 / -1", height: 6, background: PALETTE.surface,
            position: "relative", overflow: "hidden", marginTop: 20,
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: accent,
              transformOrigin: "left center",
              transform: `scaleX(${statBarT})`,
            }} />
          </div>
        </div>
      ) : (
        // Body without a stat — wider column, calmer.
        slide.body ? (
          <div style={{
            position: "absolute", left: PAGE.marginX,
            right: PAGE.marginX, bottom: PAGE.safeBottom + 100,
            fontFamily: fontSans, fontSize: bodySize, lineHeight: 1.45,
            color: PALETTE.textMuted, opacity, maxWidth: 760,
          }}>
            {slide.body}
          </div>
        ) : null
      )}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: PAGE.marginX, bottom: PAGE.safeBottom + 80,
          fontFamily: fontSerif, fontSize: 132, color: accent, lineHeight: 1,
          opacity, transform: `translateX(${(1 - enter) * 30}px)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const PressMast: React.FC<{ fontSans: string; accent: string }> = ({ fontSans, accent }) => (
  <>
    <div style={{
      position: "absolute", top: PAGE.safeTop - 50, left: PAGE.marginX, right: PAGE.marginX,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: fontSans, fontSize: 16, letterSpacing: 7, fontWeight: 700,
      color: PALETTE.text, textTransform: "uppercase",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 8, height: 8, background: accent }} />
        BRIEFING
      </span>
      <span style={{ fontFeatureSettings: "'tnum'", color: PALETTE.textMuted }}>
        DATELINE / SEOUL
      </span>
    </div>
    <div style={{
      position: "absolute", top: PAGE.safeTop - 18, left: PAGE.marginX, right: PAGE.marginX,
      height: 2, background: PALETTE.text,
    }} />
  </>
);
