CREATE TABLE `harvests` (
	`id` text PRIMARY KEY NOT NULL,
	`tandon_id` text NOT NULL,
	`date` text NOT NULL,
	`total_weight_kg` real NOT NULL,
	`total_plants` integer NOT NULL,
	`rejected` integer NOT NULL,
	`tip_burn` integer DEFAULT 0 NOT NULL,
	`root_rot` integer DEFAULT 0 NOT NULL,
	`pests` integer DEFAULT 0 NOT NULL,
	`undersized` integer DEFAULT 0 NOT NULL,
	`other` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`avg_weight_g` real DEFAULT 0 NOT NULL,
	`success_rate` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tandon_id`) REFERENCES `tandons`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_harvests_tandon` ON `harvests` (`tandon_id`);--> statement-breakpoint
CREATE INDEX `idx_harvests_date` ON `harvests` (`date`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`harvest_id` text NOT NULL,
	`tandon_id` text NOT NULL,
	`date` text NOT NULL,
	`buyer_category` text NOT NULL,
	`buyer_name` text NOT NULL,
	`sold_volume_kg` real NOT NULL,
	`price_per_kg` integer NOT NULL,
	`total_value` integer NOT NULL,
	`payment_status` text NOT NULL,
	`unsold_action` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sales_harvest` ON `sales` (`harvest_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tandon` ON `sales` (`tandon_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_date` ON `sales` (`date`);--> statement-breakpoint
CREATE TABLE `tandons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`greenhouse` text NOT NULL,
	`batch_code` text NOT NULL,
	`holes` integer DEFAULT 1000 NOT NULL,
	`sowing_date` text,
	`status` text DEFAULT 'Empty' NOT NULL,
	`color` text NOT NULL
);
