CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`handle` text NOT NULL,
	`ig_user_id` text,
	`threads_user_id` text,
	`token_kv_key` text NOT NULL,
	`token_expires_at` integer,
	`refreshed_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`,`platform`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assets_run_idx` ON `assets` (`run_id`);--> statement-breakpoint
CREATE TABLE `audio_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`artist` text,
	`source` text NOT NULL,
	`r2_key` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`bpm` integer,
	`mood_tags` text DEFAULT '[]' NOT NULL,
	`license_url` text,
	`attribution_text` text,
	`last_used_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audio_source_idx` ON `audio_tracks` (`source`);--> statement-breakpoint
CREATE INDEX `audio_user_idx` ON `audio_tracks` (`user_id`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`reach` integer DEFAULT 0 NOT NULL,
	`raw` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metrics_post_idx` ON `metrics` (`post_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`meta` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`template_slug` text,
	`platform` text NOT NULL,
	`media_type` text NOT NULL,
	`caption` text NOT NULL,
	`lang` text NOT NULL,
	`asset_keys` text DEFAULT '[]' NOT NULL,
	`audio_track_id` text,
	`remote_id` text,
	`permalink` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_user_idx` ON `posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_run_idx` ON `posts` (`run_id`);--> statement-breakpoint
CREATE INDEX `posts_published_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE TABLE `research_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`run_id` text,
	`source_url` text NOT NULL,
	`title` text,
	`summary` text,
	`raw_text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `research_topic_idx` ON `research_notes` (`topic_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`claude_session_id` text,
	`cost_usd_micros` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`error` text,
	`brief_json` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_user_idx` ON `runs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_topic_idx` ON `runs` (`topic_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `runs` (`status`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`composition_id` text NOT NULL,
	`schema` text DEFAULT '{}' NOT NULL,
	`defaults` text DEFAULT '{}' NOT NULL,
	`default_audio_mood` text DEFAULT '[]' NOT NULL,
	`preview_key` text,
	`duration_sec` integer DEFAULT 18 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `templates_user_slug_idx` ON `templates` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`lang` text DEFAULT 'ko' NOT NULL,
	`persona_prompt` text DEFAULT '' NOT NULL,
	`source_urls` text DEFAULT '[]' NOT NULL,
	`target_accounts` text DEFAULT '{}' NOT NULL,
	`template_slugs` text DEFAULT '[]' NOT NULL,
	`audio_prefs` text DEFAULT '{}' NOT NULL,
	`cron` text DEFAULT '0 9 * * *' NOT NULL,
	`next_run_at` integer,
	`daily_run_cap` integer DEFAULT 1 NOT NULL,
	`cost_cap_usd` integer DEFAULT 5 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topics_user_idx` ON `topics` (`user_id`);--> statement-breakpoint
CREATE INDEX `topics_due_idx` ON `topics` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'member' NOT NULL,
	`cost_cap_daily_usd` integer DEFAULT 20 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);