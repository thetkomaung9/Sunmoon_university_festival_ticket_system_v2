ALTER TABLE `orders`
  MODIFY COLUMN `status` enum('PENDING','PENDING_PAYMENT_VERIFICATION','PAID','CANCELLED','REFUNDED','EXPIRED') NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE `payments`
  MODIFY COLUMN `status` enum('PENDING','PENDING_VERIFICATION','PAID','REJECTED','SUCCEEDED','FAILED','REFUNDED','CANCELLED') NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
CREATE TABLE `payment_proofs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `payment_id` int,
  `uploaded_by_user_id` int,
  `receipt_image_url` text NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `rejection_reason` text,
  `reviewed_by_user_id` int,
  `reviewed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `payment_proofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tickets`
  ADD `qr_image_url` text;
