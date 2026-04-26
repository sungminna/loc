-- Idempotent seed for shared (user_id = NULL) templates.
-- Run via: bun x wrangler d1 execute loc-app --remote --file=scripts/seed-templates.sql
--
-- Existing rows: original 2 (card-news-default, threads-card-default).
-- New rows: 8 card templates + 1 video template.
-- Uses INSERT OR IGNORE so re-running is safe.

-- ─── card-news templates ────────────────────────────────────────────
INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_kinetic_type', NULL, 'kinetic-type', 'Kinetic Type',
   'reel-animated', 'instagram', 'KineticType',
   '{}', '{}', '["uplifting","epic","viral"]', 19, 1, 1,
   '#ffe45c',
   'Cinematic editorial backdrop, ultra-high contrast monochrome with a single vivid accent, minimal subject, soft volumetric light, 50mm lens, shallow depth of field. Leave large empty negative space for typography.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_bold_editorial', NULL, 'bold-editorial', 'Bold Editorial',
   'reel-cards', 'instagram', 'BoldEditorial',
   '{}', '{}', '["chill","minimal","cinematic"]', 21, 1, 1,
   '#e63946',
   'Editorial magazine still life, warm natural light, paper-textured backdrop, single hero subject offset to the right two-thirds, muted earthy palette with a single saturated accent.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_minimal_grid', NULL, 'minimal-grid', 'Minimal Grid',
   'reel-cards', 'instagram', 'MinimalGrid',
   '{}', '{}', '["minimal","ambient","vlog"]', 18, 1, 1,
   '#ffe45c',
   'Architectural minimalism, swiss-grid composition, monochrome black/white photography with soft daylight, single subject in lower-right third, generous negative space.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_neo_brutalism', NULL, 'neo-brutalism', 'Neo Brutalism',
   'reel-cards', 'instagram', 'NeoBrutalism',
   '{}', '{}', '["uplifting","viral","epic"]', 20, 1, 1,
   '#ff2d55',
   'Bold pop graphic backdrop, flat saturated risograph color, hard shadows, halftone texture, photographic subject cut out and laid over a thick-bordered colored field.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_glass_morph', NULL, 'glass-morphism', 'Glass Morphism',
   'reel-cards', 'instagram', 'GlassMorphism',
   '{}', '{}', '["chill","ambient","minimal"]', 20, 1, 1,
   '#a78bfa',
   'Dreamy gradient field with soft chromatic aberration, blurred bokeh light orbs in pink/blue/yellow, no hard subject, perfect for layering frosted glass cards on top.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_retro_vhs', NULL, 'retro-vhs', 'Retro VHS',
   'reel-animated', 'instagram', 'RetroVHS',
   '{}', '{}', '["dark","cinematic","viral"]', 20, 1, 1,
   '#ff2d92',
   'Retro VHS still, warm-tinted CRT scanlines, mild chromatic fringing, late-90s nostalgic interior or city exterior at dusk, slight motion blur, neon magenta + cyan accents.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_data_story', NULL, 'data-story', 'Data Story',
   'reel-animated', 'instagram', 'DataStory',
   '{}', '{}', '["uplifting","cinematic","epic"]', 22, 1, 1,
   '#facc15',
   'Editorial infographic backdrop, deep navy gradient, faint geometric line overlays, abstract data textures (charts, lines, dots) at low opacity, no real subject — leave room for a giant numeric stat.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_quote_spotlight', NULL, 'quote-spotlight', 'Quote Spotlight',
   'reel-cards', 'instagram', 'QuoteSpotlight',
   '{}', '{}', '["chill","minimal","ambient"]', 22, 1, 1,
   '#e63946',
   'Soft sunrise gradient backdrop, warm peach to coral, painterly texture, no people in frame, leaves room for serif quote typography on top.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);

-- ─── video reel template (Seedance 2.0) ─────────────────────────────
INSERT OR IGNORE INTO templates
  (id, user_id, slug, name, kind, platform, composition_id,
   schema, defaults, default_audio_mood, duration_sec, version, enabled,
   accent_color, bg_prompt_template, transition_preset, bg_mode, default_bg_r2_key,
   created_at, updated_at)
VALUES
  ('tpl_seedance_reel', NULL, 'seedance-reel', 'Seedance Reel (Video)',
   'reel-video', 'instagram', 'SeedanceReel',
   '{}', '{}', '["uplifting","cinematic","epic"]', 22, 1, 1,
   '#facc15',
   'Cinematic 35mm style, soft natural lighting, single clear subject, shallow depth of field, no on-screen text. The first frame should be a striking still that the video model can animate naturally.',
   'fade', 'ai', '',
   unixepoch() * 1000, unixepoch() * 1000);
