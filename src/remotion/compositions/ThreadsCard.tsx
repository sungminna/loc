import { AbsoluteFill, Img } from "remotion";
import { theme } from "../theme";

export interface ThreadsCardProps {
  brand: { handle: string; name: string };
  lang: "ko" | "en";
  headline: string;
  body?: string;
  bgImageUrl?: string;
}

export const defaultThreadsCardProps: ThreadsCardProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  headline: "오늘의 한 줄",
  body: "Threads에 어울리는 짧은 문장.",
};

export const ThreadsCard: React.FC<ThreadsCardProps> = ({ brand, lang, headline, body, bgImageUrl }) => {
  const fontFamily = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  return (
    <AbsoluteFill style={{ background: theme.bgGradient, fontFamily, color: theme.text }}>
      {bgImageUrl ? (
        <Img
          src={bgImageUrl}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 30% 20%, rgba(255,228,92,0.15), transparent 60%), radial-gradient(circle at 80% 90%, rgba(255,92,147,0.18), transparent 65%)",
        }}
      />
      <div
        style={{
          position: "relative",
          margin: "auto",
          padding: "96px 80px",
          maxWidth: 920,
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 26, color: theme.accent, letterSpacing: 6, marginBottom: 32, fontWeight: 700 }}>
          {brand.name.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 96, lineHeight: 1.1, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
          {headline}
        </h1>
        {body ? <p style={{ fontSize: 36, lineHeight: 1.5, color: theme.textMuted, marginTop: 40 }}>{body}</p> : null}
        <div style={{ marginTop: 72, fontSize: 24, color: theme.textMuted }}>{brand.handle}</div>
      </div>
    </AbsoluteFill>
  );
};
