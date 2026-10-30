CREATE TABLE `costs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`target` text NOT NULL,
	`supplier` text,
	`notes` text,
	`quantity` real,
	`unit_price` integer,
	`spread_cycles` integer DEFAULT 1 NOT NULL,
	`cycle_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_costs_date` ON `costs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_costs_target` ON `costs` (`target`);--> statement-breakpoint
CREATE INDEX `idx_costs_category` ON `costs` (`category`);--> statement-breakpoint
CREATE INDEX `idx_costs_cycle` ON `costs` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`tandon_id` text NOT NULL,
	`sowing_date` text NOT NULL,
	`cycle_end_date` text NOT NULL,
	`batch_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tandon_id`) REFERENCES `tandons`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_cycles_tandon` ON `cycles` (`tandon_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cycles_tandon_sowing` ON `cycles` (`tandon_id`,`sowing_date`);