// ThreadsCard — 1080×1350 still for Threads posts. Editorial layout
// borrowed from the NYT Magazine "Look Back" inset: hairline mast at
// the top with a date-stamped folio, a single oxblood-accented kicker,
// the headline in serif, and a left-anchored body. No brand watermark —
// the publication identity comes through the design system, not chrome.

import { AbsoluteFill, Img } from "remotion";
import { FONT } from "../fonts";
import { PALETTES, fitHeadline, fitBody } from "../layout";

const FONTS = FONT.ThreadsCard!;

export interface ThreadsCardProps {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  headline: string;
  body?: string;
  kicker?: string;
  bgImageUrl?: string;
  accent?: string;
}

const PALETTE = PALETTES.editorial;

export const defaultThreadsCardProps: ThreadsCardProps = {
  brand: { handle: "", name: "" },
  lang: "ko",
  kicker: "DISPATCH",
  headline: "오늘의 한 줄",
  body: "Threads에 어울리는 짧은 문장.",
};

export const ThreadsCard: React.FC<ThreadsCardProps> = ({ headline, body, kicker, bgImageUrl, accent }) => {
  const fontSans = FONTS.body;
  const fontSerif = FONTS.display;
  const accentColor = accent ?? PALETTE.accent;

  // Threads card is 1080×1350 (4:5). We split: top 50% photo, bottom 50%
  // type. The photo never has type on it — the cover-card discipline.
  const headlineSize = fitHeadline(headline, {
    max: 92, min: 52,
    pivots: [[6, 92], [12, 84], [18, 70], [26, 60], [38, 52]],
  });
  const bodySize = fitBody(body ?? "", { max: 30, min: 22 });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, color: PALETTE.text, fontFamily: fontSans }}>
      {/* Mast */}
      <div style={{
        position: "absolute", top: 56, left: 72, right: 72,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 14, letterSpacing: 7, fontWeight: 700,
        textTransform: "uppercase", color: PALETTE.text,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 8, height: 8, background: accentColor, borderRadius: 4 }} />
          DISPATCH
        </span>
        <span style={{ fontFeatureSettings: "'tnum'", color: PALETTE.textMuted }}>
          THREADS · 2026
        </span>
      </div>
      <div style={{
        position: "absolute", top: 92, left: 72, right: 72,
        height: 2, background: PALETTE.text,
      }} />

      {/* Photo zone — top half. Only rendered when an image is supplied;
          empty card just shows type on the cream page. */}
      {bgImageUrl ? (
        <div style={{
          position: "absolute", top: 130, left: 72, right: 72, height: 540,
          background: PALETTE.surface, overflow: "hidden",
          boxShadow: "0 18px 40px rgba(17,17,17,0.10)",
        }}>
          <Img src={bgImageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: 0.97,
          }} />
        </div>
      ) : null}

      {/* Type block — vertically positioned based on whether a photo
          zone was rendered above. With image: type starts below at 720.
          Without image: type center-aligned at 380 so the card breathes. */}
      <div style={{
        position: "absolute", top: bgImageUrl ? 720 : 380, left: 72, right: 72,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: 5,
          color: accentColor, textTransform: "uppercase",
        }}>
          {kicker ?? "DISPATCH"}
        </div>
        <h1 style={{
          fontFamily: fontSerif, fontSize: headlineSize,
          fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.02em",
          margin: "20px 0 0 0", color: PALETTE.text,
          wordBreak: "keep-all", overflowWrap: "break-word",
        }}>
          {headline}
        </h1>
        {body ? (
          <div style={{
            marginTop: 32,
            fontSize: bodySize, lineHeight: 1.5, color: PALETTE.textMuted,
            maxWidth: 880, wordBreak: "keep-all", overflowWrap: "break-word",
          }}>
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
