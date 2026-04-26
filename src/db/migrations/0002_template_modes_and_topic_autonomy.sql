-- templates: platform attribution + background-mode + static fallback bg
ALTER TABLE `templates` ADD `platform` text DEFAULT 'instagram' NOT NULL;--> statement-breakpoint
ALTER TABLE `templates` ADD `bg_mode` text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `templates` ADD `default_bg_r2_key` text DEFAULT '' NOT NULL;--> statement-breakpoint

-- backfill platform from kind for the existing seeded templates
UPDATE `templates` SET `platform` = 'threads' WHERE `kind` = 'threads-photo';--> statement-breakpoint

-- topics: AI autonomy controls + Threads format + hashtag composition
ALTER TABLE `topics` ADD `image_mode` text DEFAULT 'ai-all' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `threads_format` text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `hashtag_mode` text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `fixed_hashtags` text DEFAULT '[]' NOT NULL;
