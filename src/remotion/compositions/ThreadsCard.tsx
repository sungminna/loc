// ThreadsCard — 1080×1350 still for Threads posts. Inherits the Dossier
// design system (italic editorial serif + blueprint micro-labels + cream
// paper) so a Threads still + a Dossier reel feel like the same
// publication. The card is a single still — no motion — so we don't pull
// any animation primitives, only the layout helpers.

import { AbsoluteFill, Img } from "remotion";
import { FONT } from "../fonts";
import { PALETTES, fitHeadline, fitBody } from "../layout";

const FONTS = FONT.ThreadsCard!;
const PALETTE = PALETTES.dossier;

export interface ThreadsCardProps {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  headline: string;
  body?: string;
  kicker?: string;
  bgImageUrl?: string;
  accent?: string;
}

export const defaultThreadsCardProps: ThreadsCardProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  kicker: "FILE 07",
  headline: "오늘의 한 줄",
  body: "Threads에 어울리는 짧은 문장.",
};

export const ThreadsCard: React.FC<ThreadsCardProps> = ({ headline, body, kicker, bgImageUrl, accent }) => {
  const fontMono = FONTS.mono;
  const fontSerif = FONTS.display;
  const fontBody = FONTS.body;
  const accentColor = accent ?? PALETTE.accent;

  const headlineSize = fitHeadline(headline, {
    max: 96, min: 48,
    pivots: [[5, 96], [10, 86], [16, 70], [24, 58], [38, 48]],
  });
  const bodySize = fitBody(body ?? "", { max: 30, min: 22 });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text }}>
      {/* Faint blueprint grid — same as Dossier reel. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(44,94,140,0.06) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(44,94,140,0.06) 1px, transparent 1px)",
        backgroundSize: "60px 60px, 60px 60px",
      }} />
      {/* Outer hairline frame. */}
      <div style={{
        position: "absolute", top: 24, left: 24, right: 24, bottom: 24,
        border: `1px solid ${PALETTE.rule}`, pointerEvents: "none",
      }} />

      {/* Top mast */}
      <div style={{
        position: "absolute", top: 56, left: 72, right: 72,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: fontMono, fontSize: 13, fontWeight: 700,
        letterSpacing: 6, color: PALETTE.text, textTransform: "uppercase",
      }}>
        <span>DOSSIER · THREADS</span>
        <span style={{ color: PALETTE.textMuted }}>2026 — VOL.07</span>
      </div>
      <div style={{
        position: "absolute", top: 96, left: 72, right: 72,
        height: 1, background: PALETTE.rule,
      }} />

      {/* Specimen image frame — fixed position, never moves. */}
      {bgImageUrl ? (
        <>
          <div style={{
            position: "absolute", top: 132, left: 72, right: 72, height: 470,
            background: PALETTE.surface, overflow: "hidden",
          }}>
            <Img src={bgImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {/* Corner brackets */}
          {[
            { top: 132 - 28, left: 72 - 4, b: "0 0 2px 2px" },
            { top: 132 - 28, right: 72 - 4, b: "0 2px 2px 0" },
            { top: 132 + 470 + 4, left: 72 - 4, b: "2px 0 0 2px" },
            { top: 132 + 470 + 4, right: 72 - 4, b: "2px 2px 0 0" },
          ].map((c, i) => (
            <div key={i} style={{
              position: "absolute",
              top: c.top, left: c.left, right: c.right,
              width: 24, height: 24,
              borderColor: PALETTE.text, borderStyle: "solid", borderWidth: c.b,
            }} />
          ))}
          {/* Specimen caption beneath image */}
          <div style={{
            position: "absolute", top: 614, left: 72, right: 72,
            display: "flex", justifyContent: "space-between",
            fontFamily: fontMono, fontSize: 11, letterSpacing: 4,
            color: PALETTE.textMuted, textTransform: "uppercase",
          }}>
            <span>FIG. 01 — SPECIMEN</span>
            <span>EXP 2026 / VOL 07</span>
          </div>
        </>
      ) : null}

      {/* Type block */}
      <div style={{
        position: "absolute", top: bgImageUrl ? 670 : 380, left: 72, right: 72,
      }}>
        <div style={{
          fontFamily: fontSerif, fontStyle: "italic", fontSize: 26,
          color: accentColor, letterSpacing: "-0.005em",
        }}>
          {kicker ?? "FILE 07"}
        </div>
        <h1 style={{
          fontFamily: fontSerif, fontSize: headlineSize, fontWeight: 400,
          lineHeight: 1.04, letterSpacing: "-0.015em",
          margin: "16px 0 0 0", color: PALETTE.text,
          wordBreak: "keep-all", overflowWrap: "break-word",
        }}>
          {headline}
        </h1>
        {body ? (
          <div style={{ marginTop: 28, display: "flex", gap: 24, alignItems: "flex-start" }}>
            <span style={{
              fontFamily: fontMono, fontSize: 11, fontWeight: 700,
              letterSpacing: 4, color: accentColor, paddingTop: 4,
              minWidth: 48,
            }}>¶ 01</span>
            <p style={{
              fontFamily: fontBody, fontSize: bodySize,
              lineHeight: 1.5, letterSpacing: "-0.005em",
              color: PALETTE.text, margin: 0, flex: 1,
              wordBreak: "keep-all", overflowWrap: "break-word",
            }}>
              {body}
            </p>
          </div>
        ) : null}
      </div>

      {/* Bottom right stamp */}
      <div style={{
        position: "absolute", bottom: 56, right: 72,
        fontFamily: fontMono, fontSize: 11, fontWeight: 700,
        letterSpacing: 4, color: accentColor,
        border: `1px solid ${accentColor}`, padding: "4px 10px",
        transform: "rotate(-2deg)",
      }}>
        ☉ FILED
      </div>
    </AbsoluteFill>
  );
};
