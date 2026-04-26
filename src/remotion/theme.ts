export const theme = {
  fontFamilyKo: "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
  fontFamilyEn: "'Inter', 'Helvetica Neue', sans-serif",
  bgGradient: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)",
  accent: "#ffe45c",
  accentAlt: "#ff5c93",
  text: "#f5f5fa",
  textMuted: "rgba(245,245,250,0.65)",
  cardBg: "rgba(15, 8, 30, 0.55)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
} as const;

export type Theme = typeof theme;
