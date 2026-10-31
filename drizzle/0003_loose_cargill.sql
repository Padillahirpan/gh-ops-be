CREATE TABLE `rateLimit` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
-- SQLite tidak mengizinkan ADD COLUMN dengan default non-konstan,
-- jadi pakai default 0 lalu backfill dengan epoch sekarang.
ALTER TABLE `account` ADD `updated_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `account` SET `updated_at` = unixepoch() * 1000 WHERE `updated_at` = 0;