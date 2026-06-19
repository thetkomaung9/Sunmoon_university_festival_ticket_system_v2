CREATE TABLE `payments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `provider` varchar(64) NOT NULL,
  `payment_key` varchar(191) NOT NULL,
  `amount` int NOT NULL,
  `currency` varchar(16) NOT NULL DEFAULT 'KRW',
  `status` enum('PENDING','SUCCEEDED','FAILED','REFUNDED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `raw_payload` json,
  `paid_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `payments_id` PRIMARY KEY(`id`),
  CONSTRAINT `payments_payment_key_unique` UNIQUE(`payment_key`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ticket_id` int NOT NULL,
  `event_id` int NOT NULL,
  `order_id` int NOT NULL,
  `staff_id` int NOT NULL,
  `scan_log_id` int,
  `status` enum('CHECKED_IN','REVOKED') NOT NULL DEFAULT 'CHECKED_IN',
  `device_info` text,
  `checked_in_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `attendance_id` PRIMARY KEY(`id`),
  CONSTRAINT `attendance_ticket_id_unique` UNIQUE(`ticket_id`)
);
