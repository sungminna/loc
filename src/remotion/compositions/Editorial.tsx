// Editorial — design references: NYT Magazine, The New Yorker, Cereal.
// Two-column print layout: left column carries the kicker bar, headline
// (serif), and body. Right column is dedicated photograph zone. A hairline
// drawn across at slide-on locks the page into a ledger. No watermark —
// the masthead at top + folio number at the bottom is the only chrome.
//
// Why this exists: NYT Magazine spreads make the photograph and the
// typography negotiate, not compete — they share one grid. The mistake
// every "AI card-news" template makes is putting headline ON TOP of the
// image. We give each side of the page its own column and let the
// hairline do the binding.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, fitHeadline, fitBody, folioStamp } from "../layout";
import { easeOutExpo, splitTextProgress } from "../animations";

const SLIDE_FRAMES = 156;
const PALETTE = PALETTES.editorial;
const FONTS = FONT.Editorial!;

export const defaultEditorialProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "ISSUE 01", headline: "다시 쓰는 오늘의 규칙", body: "왜 지금 우리는 다른 답을 찾아야 하는가." },
    { kicker: "PERSPECTIVE", headline: "변하는 것", body: "노동, 도시, 관계의 정의가 흔들리는 중." },
    { kicker: "POSITION", headline: "그대로인 것", body: "여전히 작동하는 인간적 기본기들." },
    { kicker: "ACTION", headline: "이번 주의 시도", body: "단순히 알지 말고 한 가지를 직접 해 본다." },
    { kicker: "CLOSING", headline: "다음 호로 이어집니다", emphasis: "✱" },
  ],
};

export const Editorial: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const fontSans = FONTS.body;
  const fontSerif = FONTS.display;
  const list = slides.length ? slides : defaultEditorialProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      <Masthead total={list.length} fontSans={fontSans} accent={accentColor} />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps}
                fontSans={fontSans} fontSerif={fontSerif} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 36, left: 0, right: 0, textAlign: "center",
          fontFamily: fontSans, fontSize: 14, letterSpacing: 2,
          color: "rgba(26,24,21,0.40)", fontFeatureSettings: "'tnum'",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number;
  fontSans: string; fontSerif: string; accent: string;
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, fontSans, fontSerif, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 80 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // Two-column layout. The text column is wider when there is no
  // photograph (the page reflows to a single broad column — same trick
  // NYT Magazine uses on type-only feature pages).
  const PHOTO_COL = 440;
  const GUTTER = 28;
  const LEFT_X = PAGE.marginX;
  const PHOTO_X = PAGE.width - PAGE.marginX - PHOTO_COL;
  const PHOTO_W = PHOTO_COL;
  const TEXT_COL = slide.bgImageUrl
    ? PHOTO_X - LEFT_X - GUTTER
    : PAGE.width - PAGE.marginX * 2;

  // Headline pivots — narrower text column means smaller maxes; we read
  // these against TEXT_COL width so the headline never wraps mid-syllable.
  const wide = TEXT_COL >= 700;
  const headlineSize = fitHeadline(slide.headline, {
    max: wide ? 168 : (index === 0 ? 116 : 96), min: 52,
    pivots: wide
      ? [[6, 168], [12, 142], [20, 110], [30, 84], [40, 64]]
      : index === 0
        ? [[6, 116], [10, 100], [16, 82], [24, 64], [38, 52]]
        : [[6, 96], [10, 84], [16, 72], [24, 60], [38, 52]],
    korean: true,
  });
  const bodySize = fitBody(slide.body ?? "", { max: wide ? 36 : 30, min: 22 });

  // Hairline draws across as the page settles. Magazine spreads open with
  // a single horizontal rule that reads as the bind line — we mimic it.
  const ruleWidth = interpolate(enter, [0, 1], [0, PAGE.width - PAGE.marginX * 2], {
    easing: easeOutExpo,
  });

  // The photograph column is rendered ONLY when there is an image. Empty
  // photo zones read as "broken image" against editorial paper; we'd
  // rather the page just be type when no image is supplied. NYT Magazine
  // does both: full-bleed feature spreads AND pure type spreads.
  const hasImage = !!slide.bgImageUrl;

  return (
    <AbsoluteFill>
      {hasImage && slide.bgImageUrl ? (
        <div style={{
          position: "absolute", top: PAGE.safeTop + 56, bottom: PAGE.safeBottom + 60,
          left: PHOTO_X, width: PHOTO_W,
          background: PALETTE.surface,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(26,24,21,0.10)",
        }}>
          <Img src={slide.bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${interpolate(frame, [0, SLIDE_FRAMES + 12], [1.0, 1.06])})`,
            opacity: 0.96,
          }} />
        </div>
      ) : null}

      {/* Hairline rule under the headline — draws across the text column. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, top: 980,
        width: Math.min(ruleWidth, TEXT_COL), height: 1, background: PALETTE.rule,
      }} />

      {/* Text column — kicker, headline, body all share one column so the
          page reads as a single voice. */}
      <div style={{
        position: "absolute", top: PAGE.safeTop + 96, left: LEFT_X, width: TEXT_COL,
        opacity,
      }}>
        {slide.kicker ? (
          <div style={{
            fontFamily: fontSans, fontSize: 22, fontWeight: 700,
            letterSpacing: 6, color: accent, textTransform: "uppercase",
            transform: `translateX(${(1 - enter) * -22}px)`,
          }}>
            {slide.kicker}
          </div>
        ) : null}

        <h1 style={{
          fontFamily: fontSerif, fontSize: headlineSize, fontWeight: 900,
          lineHeight: 1.02, letterSpacing: "-0.02em", margin: "44px 0 0 0",
          color: PALETTE.text,
          // Korean keep-all prevents splitting inside a syllable group.
          wordBreak: "keep-all",
          overflowWrap: "break-word",
        }}>
          {slide.headline.split(/\s+/).map((w, i) => {
            const t = splitTextProgress(frame, fps, i, { startFrame: 6, perItemFrames: 4, durationFrames: 18 });
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: ".22em",
                opacity: t,
                transform: `translateY(${(1 - t) * 18}px)`,
              }}>
                {w}
              </span>
            );
          })}
        </h1>
      </div>

      {slide.body ? (
        <div style={{
          position: "absolute", top: 1020, left: LEFT_X, width: TEXT_COL,
          opacity, transform: `translateY(${(1 - enter) * 16}px)`,
        }}>
          {/* A single accent square in lieu of a drop cap — the kicker
              already plays the section-header role; a serif drop-cap on
              top of it reads as redundant signage. */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
            <div style={{
              width: 14, height: 14, background: accent,
              flex: "0 0 auto", marginTop: 14,
            }} />
            <div style={{
              fontFamily: fontSans, fontSize: bodySize, lineHeight: 1.5,
              color: PALETTE.textMuted, fontWeight: 400,
              wordBreak: "keep-all", overflowWrap: "break-word",
            }}>
              {slide.body}
            </div>
          </div>
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", left: LEFT_X, bottom: PAGE.safeBottom + 90,
          fontFamily: fontSerif, fontStyle: "italic", fontSize: 144,
          color: accent, lineHeight: 1, opacity,
          transform: `rotate(${(1 - enter) * -8}deg)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}

      {/* Folio + signature line — bottom of page. tnum so digits align. */}
      <div style={{
        position: "absolute", left: PAGE.marginX, right: PAGE.marginX,
        bottom: PAGE.safeBottom - 50,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: fontSans, fontSize: 14, letterSpacing: 4,
        color: "rgba(26,24,21,0.50)", fontFeatureSettings: "'tnum'",
        textTransform: "uppercase",
      }}>
        <span>FOLIO</span>
        <span>{folioStamp(index, total)}</span>
      </div>
    </AbsoluteFill>
  );
};

const Masthead: React.FC<{ total: number; fontSans: string; accent: string }> = ({ fontSans, accent }) => (
  <>
    <div style={{
      position: "absolute", top: PAGE.safeTop - 50, left: PAGE.marginX, right: PAGE.marginX,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: fontSans, fontSize: 16, letterSpacing: 7, fontWeight: 700,
      color: PALETTE.text, textTransform: "uppercase",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 8, height: 8, background: accent, borderRadius: 4 }} />
        EDITORIAL
      </span>
      <span style={{ fontFeatureSettings: "'tnum'" }}>VOL · 26</span>
    </div>
    <div style={{
      position: "absolute", top: PAGE.safeTop - 18, left: PAGE.marginX, right: PAGE.marginX,
      height: 2, background: PALETTE.text,
    }} />
  </>
);
