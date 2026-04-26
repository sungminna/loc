-- topics: storyboard draft + per-topic image style + flag to use draft for next run
ALTER TABLE `topics` ADD `image_style_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `topics` ADD `draft_brief` text;--> statement-breakpoint
ALTER TABLE `topics` ADD `use_draft_for_next` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- templates: visual + per-template image-prompt template + transition preset
ALTER TABLE `templates` ADD `accent_color` text DEFAULT '#facc15' NOT NULL;--> statement-breakpoint
ALTER TABLE `templates` ADD `bg_prompt_template` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `templates` ADD `transition_preset` text DEFAULT 'fade' NOT NULL;--> statement-breakpoint

-- skill prompts: per-user, per-skill instruction overrides
CREATE TABLE `skill_prompts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `skill_name` text NOT NULL,
  `override` text DEFAULT '' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `skill_prompts_user_skill_idx` ON `skill_prompts` (`user_id`,`skill_name`);--> statement-breakpoint

-- topic_assets: dashboard-generated images, decoupled from runs
CREATE TABLE `topic_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `topic_id` text NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL,
  `r2_key` text NOT NULL,
  `mime` text NOT NULL,
  `bytes` integer DEFAULT 0 NOT NULL,
  `prompt` text DEFAULT '' NOT NULL,
  `slide_index` integer,
  `meta` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `topic_assets_topic_idx` ON `topic_assets` (`topic_id`,`created_at`);
