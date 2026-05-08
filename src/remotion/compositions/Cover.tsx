// Cover — design references: Vogue, W, Numéro covers. The signature
// move is the giant serif italic logotype occupying the upper third and
// *deliberately overlapping* the subject's hairline (the model is famous
// enough that the face still reads). Cover lines run as small tracked-out
// caps along the side gutter. Photo is full-bleed.
//
// Why this exists: the prior QuoteSpotlight + GlassMorphism templates
// were both "soft gradient with a centered card on top" — they collapsed
// into one design. This replaces them with a single tighter idea: a
// photograph carrying the slide, type cropping into it like a printed
// cover would. Quote / authority / personal-essay tone.

import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, fitHeadline, fitBody, folioStamp } from "../layout";
import { easeOutExpo } from "../animations";

const SLIDE_FRAMES = 168;
const PALETTE = PALETTES.cover;
const FONTS = FONT.Cover!;

export const defaultCoverProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "FEATURE", headline: "결국 남는 건 시간이다", body: "확실하지 않은 채로도 시작할 수 있다." },
    { kicker: "POSITION", headline: "느린 진전은 진전이다", body: "오늘 한 줄만 적어 두자." },
    { kicker: "ESSAY", headline: "기다려도 늦지 않는 것", body: "급하다는 감각이 가장 비싼 거짓이라는 걸 알게 된 시점." },
    { kicker: "OUTRO", headline: "한 줄 옮기기", emphasis: "✍︎" },
  ],
};

export const Cover: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  // Cover uses Bodoni Moda italic (Vogue Didone equivalent) for the
  // logotype-style title; Korean serif falls to Nanum Myeongjo Bold
  // since hangul serifs do not have an italic cut.
  const fontSans = FONTS.body;
  const fontSerif = FONTS.display;
  const list = slides.length ? slides : defaultCoverProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps}
                fontSans={fontSans} fontSerif={fontSerif} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center",
          fontFamily: fontSans, fontSize: 12, letterSpacing: 4,
          color: "rgba(246,239,228,0.40)", fontFeatureSettings: "'tnum'",
          textTransform: "uppercase",
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
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7, stiffness: 80 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  // Vogue title behavior — letters land tight from a wider tracking. The
  // letter-spacing collapse from 0.18em → -0.02em makes the headline feel
  // like it's "printing" into place rather than fading.
  const tracking = interpolate(enter, [0, 1], [0.22, -0.02], { easing: easeOutExpo });

  // Cover headlines wrap badly mid-syllable when the font is too big;
  // back off the max so 8-12 char Korean lines breathe.
  const headlineSize = fitHeadline(slide.headline, {
    max: 124, min: 64,
    pivots: [[5, 124], [9, 108], [14, 92], [22, 78], [34, 64]],
    korean: true,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 30, min: 22 });

  return (
    <AbsoluteFill>
      {/* Full-bleed photograph (or atmospheric charcoal field if missing).
          Vogue covers give the image the entire page; the title crops INTO it.
          When no image, we render a layered charcoal field with a spotlight
          gradient + faint vertical hairline — gives the page atmosphere
          without screaming "missing image". */}
      <div style={{ position: "absolute", inset: 0, background: PALETTE.bg }}>
        {slide.bgImageUrl ? (
          <Img src={slide.bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: 0.94,
            transform: `scale(${interpolate(frame, [0, SLIDE_FRAMES + 12], [1, 1.03])})`,
            filter: "saturate(0.92) contrast(1.03)",
          }} />
        ) : (
          <>
            <div style={{
              width: "100%", height: "100%",
              background: `
                radial-gradient(ellipse 70% 60% at 50% 35%, #3b322c 0%, ${PALETTE.surface} 60%, ${PALETTE.bg} 100%),
                repeating-linear-gradient(90deg, transparent 0 70px, rgba(255,255,255,0.018) 70px 71px)
              `,
            }} />
            {/* Subtle film-grain dot pattern — keeps the dark zone alive. */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 1.4px)",
              backgroundSize: "4px 4px",
            }} />
          </>
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.7) 100%)",
        }} />
      </div>

      {/* Side gutter cover lines — Vogue all-caps tracked-out blurbs run
          along the left margin. Implementing as letter-stack (one char per
          row) is more reliable than CSS writing-mode for mixed Korean +
          Latin in Remotion's headless Chromium. */}
      <div style={{
        position: "absolute", left: 30, top: PAGE.safeTop + 320,
        fontFamily: fontSans, fontSize: 14, letterSpacing: 1, fontWeight: 800,
        color: PALETTE.text, opacity: opacity * 0.78,
        textTransform: "uppercase",
        textShadow: "0 1px 6px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 2, lineHeight: 1.0,
      }}>
        {(slide.kicker ?? "FEATURE").split("").map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
        <span style={{ height: 14 }} />
        <span style={{ width: 1, height: 22, background: PALETTE.text, opacity: 0.4 }} />
        <span style={{ height: 8 }} />
        {folioStamp(index, total).split("").map((ch, i) => (
          <span key={`f${i}`} style={{ fontFeatureSettings: "'tnum'", color: accent }}>{ch}</span>
        ))}
      </div>

      {/* Title — giant serif italic in the upper third. INTENTIONALLY
          intersects the photographic subject, the way a magazine cover
          would. White ink on the photo, single warm-metal accent on the
          punctuation/emphasis. */}
      <div style={{
        position: "absolute", left: PAGE.marginX + 60, right: PAGE.marginX,
        top: PAGE.safeTop + 80,
        fontFamily: fontSerif, fontStyle: "italic", fontWeight: 900,
        fontSize: headlineSize, lineHeight: 0.96,
        color: PALETTE.text,
        letterSpacing: `${tracking}em`,
        opacity,
        textShadow: "0 4px 30px rgba(0,0,0,0.55)",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}>
        {slide.headline}
      </div>

      {/* Hairline rule sliding out under the title */}
      <div style={{
        position: "absolute", left: PAGE.marginX + 60, top: PAGE.safeTop + 80 + headlineSize + 24,
        height: 2, background: accent,
        width: interpolate(enter, [0, 1], [0, 220], { easing: easeOutExpo }),
        opacity: opacity * 0.95,
      }} />

      {/* Body / quote line — sits at lower-third, plain sans, narrower. */}
      {slide.body ? (
        <div style={{
          position: "absolute", left: PAGE.marginX + 60, right: PAGE.marginX,
          bottom: PAGE.safeBottom + 110,
          fontFamily: fontSans, fontSize: bodySize, lineHeight: 1.45,
          color: PALETTE.text, fontWeight: 400,
          opacity,
          maxWidth: 740,
          transform: `translateY(${(1 - enter) * 18}px)`,
          textShadow: "0 2px 12px rgba(0,0,0,0.55)",
        }}>
          {slide.body}
        </div>
      ) : null}

      {/* Attribution / signature */}
      {slide.attribution ? (
        <div style={{
          position: "absolute", left: PAGE.marginX + 60, bottom: PAGE.safeBottom + 50,
          fontFamily: fontSerif, fontSize: 26, fontWeight: 800, fontStyle: "italic",
          color: accent, letterSpacing: 1, opacity,
        }}>
          — {slide.attribution}
        </div>
      ) : null}

      {slide.emphasis ? (
        <div style={{
          position: "absolute", right: PAGE.marginX + 12, bottom: PAGE.safeBottom + 220,
          fontFamily: fontSerif, fontSize: 200, color: accent, lineHeight: 1, opacity,
          transform: `rotate(${(1 - enter) * -10}deg)`,
        }}>
          {slide.emphasis}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
