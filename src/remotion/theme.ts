export const theme = {
  fontFamilyKo: "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
  fontFamilyEn: "'Inter', 'Helvetica Neue', sans-serif",
  fontFamilySerif: "'Playfair Display', 'Noto Serif KR', 'Apple SD Gothic Neo', serif",
  fontFamilyMono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  bgGradient: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)",
  accent: "#ffe45c",
  accentAlt: "#ff5c93",
  text: "#f5f5fa",
  textMuted: "rgba(245,245,250,0.65)",
  cardBg: "rgba(15, 8, 30, 0.55)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
} as const;

// Per-template palette presets — each template uses one as a starting
// point and lets the topic-supplied accent override the highlight.

export const palettes = {
  ink: {
    bg: "#0a0a0a",
    surface: "#161616",
    text: "#fafafa",
    textMuted: "rgba(250,250,250,0.6)",
    accent: "#ffe45c",
  },
  sunrise: {
    bg: "linear-gradient(180deg, #ff6b6b 0%, #ffd166 60%, #ffeac4 100%)",
    surface: "rgba(255,255,255,0.85)",
    text: "#1a1014",
    textMuted: "rgba(26,16,20,0.65)",
    accent: "#ff3b6f",
  },
  midnight: {
    bg: "linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)",
    surface: "rgba(15,8,30,0.55)",
    text: "#f5f5fa",
    textMuted: "rgba(245,245,250,0.65)",
    accent: "#ffe45c",
  },
  paper: {
    bg: "#f5f1ea",
    surface: "#ffffff",
    text: "#181613",
    textMuted: "rgba(24,22,19,0.55)",
    accent: "#e63946",
  },
  brutalist: {
    bg: "#fffe00",
    surface: "#ffffff",
    text: "#000000",
    textMuted: "rgba(0,0,0,0.7)",
    accent: "#ff2d55",
  },
  neon: {
    bg: "#04020a",
    surface: "rgba(255,255,255,0.04)",
    text: "#e8f3ff",
    textMuted: "rgba(232,243,255,0.6)",
    accent: "#00f0ff",
  },
  vhs: {
    bg: "#100610",
    surface: "rgba(0,0,0,0.4)",
    text: "#f8e9ff",
    textMuted: "rgba(248,233,255,0.65)",
    accent: "#ff2d92",
  },
} as const;

export type Theme = typeof theme;
export type PaletteName = keyof typeof palettes;
