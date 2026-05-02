// Shared brief types, used by every reel composition. The default reel
// pipeline emits a brief.json that gets adapted into these props. Most
// templates use the same shape so a topic can swap template without
// rebriefing — extra fields are optional and degrade gracefully.

export interface ReelSlide {
  kicker?: string;
  headline: string;
  body?: string;
  emphasis?: string;
  /** Single number or short stat highlighted in DataStory / NeoBrutalism. */
  stat?: { value: string; label?: string; suffix?: string };
  /** Quote attribution for QuoteSpotlight. */
  attribution?: string;
  /** Background image URL — typically gpt-image-2 output uploaded to R2. */
  bgImageUrl?: string;
}

export interface ReelBrand {
  handle: string;
  name: string;
}

export interface ReelCommonProps {
  brand: ReelBrand;
  lang: "ko" | "en";
  audioUrl?: string;
  attribution?: string;
  /**
   * Hex accent override (e.g. template.accentColor). Card templates use
   * their palette accent unless this is set; SeedanceReel always honors
   * it. Keep optional so existing brief.json blobs without `accent` keep
   * rendering with the template's natural color.
   */
  accent?: string;
}

export interface CardSlideProps extends ReelCommonProps {
  slides: ReelSlide[];
}

// Video-reel (Seedance) brief — one scene per Seedance generation.
export interface ReelVideoScene {
  kicker?: string;
  headline?: string;
  body?: string;
  /** Optional stat to overlay during the scene (animated count-up). */
  stat?: { value: string; label?: string; suffix?: string };
  /** Public URL of the rendered MP4 (R2). Required at render-time. */
  videoUrl?: string;
  /** Internal r2 key for traceability. */
  videoR2Key?: string;
  /** Length the brief asked Seedance to produce — used as a hint when
   *  the actual MP4 metadata is unavailable. The composition still
   *  truncates to whatever the file actually contains. */
  durationSec?: number;
  /** A short label that flashes on entry as a chapter card. */
  chapter?: string;
}

export interface VideoReelProps extends ReelCommonProps {
  scenes: ReelVideoScene[];
}
