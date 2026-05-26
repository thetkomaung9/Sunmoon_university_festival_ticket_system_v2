CREATE TABLE `event_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name_mm` varchar(191) NOT NULL,
	`name_en` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`description` text,
	`poster_url` text,
	`status` enum('ACTIVE','HIDDEN') NOT NULL DEFAULT 'ACTIVE',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`title_mm` varchar(191),
	`description` text,
	`venue` varchar(191) NOT NULL,
	`poster_url` text,
	`starts_at` bigint NOT NULL,
	`ends_at` bigint NOT NULL,
	`sale_starts_at` bigint NOT NULL,
	`sale_ends_at` bigint NOT NULL,
	`status` enum('DRAFT','PUBLISHED','CLOSED','CANCELLED') NOT NULL DEFAULT 'PUBLISHED',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchant_uid` varchar(64) NOT NULL,
	`event_id` int NOT NULL,
	`ticket_type_id` int NOT NULL,
	`user_id` int,
	`buyer_name` varchar(191) NOT NULL,
	`buyer_email` varchar(320) NOT NULL,
	`buyer_phone` varchar(64),
	`quantity` int NOT NULL DEFAULT 1,
	`total_amount` int NOT NULL,
	`status` enum('PENDING','PAID','CANCELLED','REFUNDED','EXPIRED') NOT NULL DEFAULT 'PENDING',
	`payment_provider` varchar(64),
	`payment_key` varchar(191),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`paid_at` timestamp,
	`cancelled_at` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_merchant_uid_unique` UNIQUE(`merchant_uid`)
);
--> statement-breakpoint
CREATE TABLE `payment_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int,
	`provider` varchar(64) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`payload` json,
	`verified` enum('true','false') NOT NULL DEFAULT 'false',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int,
	`staff_id` int,
	`result` enum('SUCCESS','ALREADY_USED','INVALID','CANCELLED','EXPIRED') NOT NULL,
	`device_info` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`name` enum('Regular','VIP','Early Bird','Student') NOT NULL,
	`price` int NOT NULL,
	`stock` int NOT NULL,
	`sold_count` int NOT NULL DEFAULT 0,
	`max_per_user` int NOT NULL DEFAULT 5,
	`status` enum('ACTIVE','SOLD_OUT','HIDDEN') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`event_id` int NOT NULL,
	`ticket_type_id` int NOT NULL,
	`ticket_code` varchar(64) NOT NULL,
	`qr_token_hash` varchar(128) NOT NULL,
	`status` enum('VALID','USED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'VALID',
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	`used_at` timestamp,
	`used_by_user_id` int,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_ticket_code_unique` UNIQUE(`ticket_code`),
	CONSTRAINT `tickets_qr_token_hash_unique` UNIQUE(`qr_token_hash`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','staff','admin') NOT NULL DEFAULT 'user';