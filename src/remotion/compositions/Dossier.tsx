// Dossier — Micrographics / Heritage / Blueprint template (2026 Trend:
// micrographics, technical-information aesthetic, heritage reimagined).
//
// Concept: technical-document layout. Dense corner data, registration
// marks, blueprint hairlines that draw on, schematic captions, italic
// editorial heads. The page reads like a specimen sheet — every element
// labelled, timestamped, gridded. Bg image (when present) sits inside a
// "specimen" frame with corner brackets, fixed, never moves.
//
// Differentiators:
//   - Only template that uses an italic editorial serif as the headline
//     (Aurora/Gummy/Kinetic/Zine all run grotesque/display sans).
//   - Only template with blueprint cyan + crimson stamp + cream paper.
//   - Only template with corner brackets + registration ticks + drawn
//     hairlines (technical-document chrome).
//   - Most data-dense — every corner has a label, dossier number, date.

import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardSlideProps, ReelSlide } from "../types";
import { FONT } from "../fonts";
import { PALETTES, PAGE, IMAGE_FRAME, fitHeadline, fitBody, fitStat, folioStamp } from "../layout";
import { drawOn, easeOutExpo, scrambleText, splitTextProgress } from "../animations";
import { BgImage } from "../shared/BgImage";

const SLIDE_FRAMES = 162;
const PALETTE = PALETTES.dossier;
const FONTS = FONT.Dossier!;

export const defaultDossierProps: CardSlideProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  slides: [
    { kicker: "FILE 07.A", headline: "관찰 보고서", body: "한 분기를 가로지른 미세 변화의 기록.", stat: { value: "37.5665", label: "LAT" } },
    { kicker: "FILE 07.B", headline: "데이터 단면", body: "개별 표본 32건 중 28건이 같은 방향을 가리킨다.", stat: { value: "39.2조", label: "VOL" } },
    { kicker: "FILE 07.C", headline: "방법", body: "샘플 수집 — 정렬 — 교차 검증의 세 단계." },
    { kicker: "FILE 07.D", headline: "다음 측정", body: "다음 호로 이어지는 항목." },
  ],
};

export const Dossier: React.FC<CardSlideProps> = ({ slides, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const list = slides.length ? slides : defaultDossierProps.slides;
  const accentColor = accent ?? PALETTE.accent;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.32} /> : null}

      {/* Static blueprint background — light grid + corner registration. */}
      <BlueprintGrid />

      {list.map((s, i) => (
        <Sequence key={i} from={i * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES + 12}>
          <Page slide={s} index={i} total={list.length} fps={fps} accent={accentColor} />
        </Sequence>
      ))}

      {attribution ? (
        <div style={{
          position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 3,
          color: "rgba(24,22,19,0.4)",
        }}>{attribution}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const BlueprintGrid: React.FC = () => (
  <>
    {/* Faint cyan grid — 60×60 cells, low opacity so it reads as paper texture. */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage:
        "linear-gradient(rgba(44,94,140,0.07) 1px, transparent 1px)," +
        "linear-gradient(90deg, rgba(44,94,140,0.07) 1px, transparent 1px)",
      backgroundSize: "60px 60px, 60px 60px",
    }} />
    {/* Outer rule frame — 1px ink hairline 24px in from edge. */}
    <div style={{
      position: "absolute", top: 24, left: 24, right: 24, bottom: 24,
      border: `1px solid ${PALETTE.rule}`,
      pointerEvents: "none",
    }} />
  </>
);

interface PageProps {
  slide: ReelSlide; index: number; total: number; fps: number; accent: string;
}

const Page: React.FC<PageProps> = ({ slide, index, total, fps, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 90 } });
  const exit = interpolate(frame, [SLIDE_FRAMES - 14, SLIDE_FRAMES + 10], [1, 0], { extrapolateRight: "clamp" });
  const opacity = enter * exit;

  const headlineSize = fitHeadline(slide.headline, {
    max: 132, min: 60,
    columnPx: PAGE.width - PAGE.marginX * 2,
  });
  const bodySize = fitBody(slide.body ?? "", { max: 32, min: 22 });

  // Hairline draw-on under headline.
  const ruleW = PAGE.width - PAGE.marginX * 2;
  const ruleOffset = drawOn(frame, ruleW, { startFrame: 4, durationFrames: 28 });

  return (
    <AbsoluteFill>
      {/* Top mast — DOSSIER + dossier number. */}
      <div style={{
        position: "absolute", top: 60, left: PAGE.marginX, right: PAGE.marginX,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
        letterSpacing: 6, color: PALETTE.text,
        textTransform: "uppercase",
      }}>
        <span>DOSSIER 07</span>
        <span style={{ display: "inline-flex", gap: 14, alignItems: "baseline" }}>
          <span style={{ color: accent }}>● CLASS A</span>
          <span style={{ color: PALETTE.textMuted }}>2026 — VOL.07</span>
        </span>
      </div>
      <div style={{
        position: "absolute", top: 102, left: PAGE.marginX, right: PAGE.marginX,
        height: 1, background: PALETTE.rule,
      }} />

      {/* Specimen image frame — fixed. */}
      <BgImage
        url={slide.bgImageUrl}
        frame={IMAGE_FRAME.dossier}
        surface={PALETTE.surface}
        rule={PALETTE.rule}
      />

      {/* Specimen caption — beneath image, mono micro-labels. */}
      {slide.bgImageUrl ? (
        <div style={{
          position: "absolute",
          top: IMAGE_FRAME.dossier.top + IMAGE_FRAME.dossier.height + 12,
          left: IMAGE_FRAME.dossier.left, right: PAGE.width - (IMAGE_FRAME.dossier.left + IMAGE_FRAME.dossier.width),
          display: "flex", justifyContent: "space-between",
          fontFamily: FONTS.mono, fontSize: 12, fontWeight: 400,
          letterSpacing: 4, color: PALETTE.textMuted,
          textTransform: "uppercase",
        }}>
          <span>FIG. {String(index + 1).padStart(2, "0")} — SPECIMEN</span>
          <span>EXP {String(2024 + (index % 3)).padStart(4, "0")}.{String((index * 3 + 5) % 12 + 1).padStart(2, "0")}</span>
        </div>
      ) : null}

      {/* Kicker — italic serif file number. */}
      {slide.kicker ? (
        <div style={{
          position: "absolute",
          top: slide.bgImageUrl ? 920 : 240,
          left: PAGE.marginX,
          fontFamily: FONTS.display, fontStyle: "italic", fontSize: 28,
          color: accent,
          letterSpacing: "-0.005em",
          opacity,
        }}>
          {scrambleText(slide.kicker, frame, { startFrame: 0, perCharFrames: 2 })}
        </div>
      ) : null}

      {/* Headline — italic serif, large. */}
      <div style={{
        position: "absolute",
        top: slide.bgImageUrl ? 970 : 300,
        left: PAGE.marginX, right: PAGE.marginX,
        opacity,
      }}>
        <h1 style={{
          fontFamily: FONTS.display,
          fontSize: headlineSize, fontWeight: 400,
          fontStyle: slide.bgImageUrl ? "italic" : "normal",
          lineHeight: 1.0, letterSpacing: "-0.015em",
          margin: 0, color: PALETTE.text,
          wordBreak: "keep-all", overflowWrap: "break-word",
        }}>
          {slide.headline.split(/\s+/).map((w, i) => {
            const t = splitTextProgress(frame, fps, i, { startFrame: 6, perItemFrames: 4, durationFrames: 20 });
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: ".22em",
                opacity: t,
                transform: `translateY(${(1 - t) * 18}px)`,
              }}>{w}</span>
            );
          })}
        </h1>
      </div>

      {/* Hairline rule — draws on. SVG so we can stroke-dasharray. */}
      <svg style={{
        position: "absolute", left: PAGE.marginX,
        top: slide.bgImageUrl ? 1140 : 540,
        width: ruleW, height: 4, overflow: "visible",
      }}>
        <line x1={0} y1={2} x2={ruleW} y2={2}
          stroke={PALETTE.text} strokeWidth={1}
          strokeDasharray={ruleW} strokeDashoffset={ruleOffset}
        />
      </svg>

      {/* Emphasis figure — when a slide is a "close" card with no body
          but has a single mark (☉ ✱ etc.), render it as a giant figure
          beneath the rule. Keeps the slide from feeling unfinished while
          staying in the dossier visual register. */}
      {slide.emphasis && !slide.body ? (
        <div style={{
          position: "absolute",
          top: slide.bgImageUrl ? 1200 : 640,
          left: PAGE.marginX, right: PAGE.marginX,
          display: "flex", alignItems: "baseline", gap: 28,
          opacity, transform: `translateY(${(1 - enter) * 16}px)`,
        }}>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
            letterSpacing: 4, color: PALETTE.accent2,
            paddingTop: 24, minWidth: 88,
            textTransform: "uppercase",
          }}>
            ¶ END
          </div>
          <div style={{
            fontFamily: FONTS.display, fontStyle: "italic",
            fontSize: 240, lineHeight: 1, color: accent,
            letterSpacing: "-0.04em",
            transform: `rotate(${(1 - enter) * -6}deg)`,
            transformOrigin: "0% 100%",
          }}>
            {slide.emphasis}
          </div>
        </div>
      ) : null}

      {/* Body — Pretendard / Geist body, indented column. */}
      {slide.body ? (
        <div style={{
          position: "absolute",
          top: slide.bgImageUrl ? 1180 : 580,
          left: PAGE.marginX, right: PAGE.marginX,
          display: "flex", gap: 32, alignItems: "flex-start",
          opacity, transform: `translateY(${(1 - enter) * 16}px)`,
        }}>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
            letterSpacing: 4, color: accent,
            paddingTop: 8, minWidth: 64,
          }}>
            ¶ {String(index + 1).padStart(2, "0")}
          </div>
          <p style={{
            fontFamily: FONTS.body, fontSize: bodySize,
            fontWeight: 400, lineHeight: 1.55, letterSpacing: "-0.005em",
            margin: 0, color: PALETTE.text, flex: 1,
            wordBreak: "keep-all", overflowWrap: "break-word",
            maxWidth: 760,
          }}>
            {slide.body}
          </p>
        </div>
      ) : null}

      {/* Stat block — bottom-left, blueprint cyan, big tabular figure. */}
      {slide.stat ? (
        <div style={{
          position: "absolute",
          bottom: PAGE.safeBottom + 12,
          left: PAGE.marginX,
          paddingLeft: 16,
          borderLeft: `2px solid ${PALETTE.accent2}`,
          opacity: interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp", easing: easeOutExpo }),
        }}>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
            letterSpacing: 4, color: PALETTE.accent2,
            textTransform: "uppercase",
          }}>
            {slide.stat.label ?? "INDEX"}
          </div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: fitStat(slide.stat.value, { max: 64, min: 32 }),
            fontWeight: 700, color: PALETTE.text,
            letterSpacing: "-0.01em", lineHeight: 1.05,
            fontFeatureSettings: "'tnum'",
          }}>
            {slide.stat.value}{slide.stat.suffix ?? ""}
          </div>
        </div>
      ) : null}

      {/* Bottom mast — folio + crimson stamp. */}
      <div style={{
        position: "absolute", bottom: 64, left: PAGE.marginX, right: PAGE.marginX,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
        letterSpacing: 6, color: PALETTE.text,
        textTransform: "uppercase",
      }}>
        <span>{folioStamp(index, total)}</span>
        <span style={{
          color: accent, border: `1px solid ${accent}`,
          padding: "4px 12px",
          transform: "rotate(-2deg)",
          fontWeight: 700,
        }}>
          ☉ FILED
        </span>
      </div>
    </AbsoluteFill>
  );
};
