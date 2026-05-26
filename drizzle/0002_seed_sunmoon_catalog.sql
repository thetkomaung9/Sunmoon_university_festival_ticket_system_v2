INSERT INTO `event_categories` (`name_mm`, `name_en`, `slug`, `description`, `poster_url`, `status`, `sort_order`) VALUES
('သီတင်းကျွတ်ပွဲတော်', 'Thadingyut Festival', 'thadingyut-festival', 'Myanmar Festival of Lights - celebrating the end of Buddhist Lent with lanterns, candles and traditional performances.', '/categories/lanterns_f8e4aa28.jpg', 'ACTIVE', 1),
('သင်္ကြန်ပွဲတော်', 'Thingyan Festival', 'thingyan-festival', 'Myanmar New Year Water Festival - joyful water-pouring celebrations, music, and cultural showcases.', '/categories/thingyan2_06241482.jpg', 'ACTIVE', 2),
('ယဉ်ကျေးမှု ည', 'Cultural Night', 'cultural-night', 'Sunmoon University Myanmar Team cultural showcases throughout the academic year.', '/categories/campus_7cd4cd72.jpg', 'ACTIVE', 3)
ON DUPLICATE KEY UPDATE
  `name_mm` = VALUES(`name_mm`),
  `name_en` = VALUES(`name_en`),
  `description` = VALUES(`description`),
  `poster_url` = VALUES(`poster_url`),
  `status` = VALUES(`status`),
  `sort_order` = VALUES(`sort_order`);
--> statement-breakpoint
INSERT INTO `events` (`category_id`, `slug`, `title`, `title_mm`, `description`, `venue`, `poster_url`, `starts_at`, `ends_at`, `sale_starts_at`, `sale_ends_at`, `status`) VALUES
((SELECT `id` FROM `event_categories` WHERE `slug` = 'thadingyut-festival'), 'thadingyut-night-2026', 'Thadingyut Night of Lights 2026', 'သီတင်းကျွတ် မီးထွန်းပွဲ ၂၀၂၆', 'A magical evening at Sunmoon University celebrating the end of Buddhist Lent with thousands of glowing lanterns, traditional Myanmar dance performances by SMU Myanmar Team members, classical music, and authentic food stalls. Join us as we transform the Asan campus into a sea of light.', 'Sunmoon University Main Auditorium, Asan Campus', '/categories/lanterns_f8e4aa28.jpg', 1792864800000, 1792879200000, 1785542400000, 1792799940000, 'PUBLISHED'),
((SELECT `id` FROM `event_categories` WHERE `slug` = 'thadingyut-festival'), 'lantern-parade-2026', 'Myanmar Lantern Parade & Cultural Showcase', 'မြန်မာမီးပုံးပြိုင်ပွဲ', 'A vibrant lantern parade across Sunmoon Asan campus followed by a cultural showcase highlighting Myanmar traditional craftsmanship, lantern-making workshops, and a closing ceremony with shared offerings.', 'Sunmoon Central Plaza', '/categories/thadingyut2_698d0b15.png', 1792949400000, 1792963800000, 1779753600000, 1792929600000, 'PUBLISHED'),
((SELECT `id` FROM `event_categories` WHERE `slug` = 'thingyan-festival'), 'thingyan-water-festival-2026', 'Thingyan Water Festival 2026', 'သင်္ကြန် ရေပက်ပွဲတော် ၂၀၂၆', 'Welcome the Myanmar New Year with the joyful water festival on the Sunmoon campus. Live Myanmar pop performances, traditional Thingyan dances, water blessing stations, Mont Lone Yay Paw and traditional Myanmar snacks, plus a special student photo contest.', 'Sunmoon Sports Field, Asan Campus', '/categories/thingyan_6265cf28.jpg', 1776074400000, 1776099600000, 1769904000000, 1776038340000, 'PUBLISHED'),
((SELECT `id` FROM `event_categories` WHERE `slug` = 'thingyan-festival'), 'thingyan-cultural-stage-2026', 'Thingyan Cultural Stage Night', 'သင်္ကြန် ယဉ်ကျေးမှု ည', 'A traditional Myanmar music and stage performance evening hosted by SMU Myanmar Team. Includes Hsaing Waing ensemble, Anyeint comedy theatre, classical Myanmar dance, and a finale fireworks display.', 'Sunmoon Grand Hall', '/categories/thingyan2_06241482.jpg', 1776191400000, 1776204000000, 1769904000000, 1776168000000, 'PUBLISHED'),
((SELECT `id` FROM `event_categories` WHERE `slug` = 'cultural-night'), 'myanmar-night-2026', 'Sunmoon Myanmar Night 2026', 'ဆန်းမွန် မြန်မာည ၂၀၂၆', 'The flagship annual showcase by Sunmoon University Myanmar Team. A 3-hour curated cultural evening featuring traditional dance, modern Myanmar music, fashion show of regional costumes, and an after-party with Myanmar street food.', 'Sunmoon Performing Arts Center', '/categories/campus_7cd4cd72.jpg', 1780855200000, 1780869600000, 1775001600000, 1780790340000, 'PUBLISHED')
ON DUPLICATE KEY UPDATE
  `category_id` = VALUES(`category_id`),
  `title` = VALUES(`title`),
  `title_mm` = VALUES(`title_mm`),
  `description` = VALUES(`description`),
  `venue` = VALUES(`venue`),
  `poster_url` = VALUES(`poster_url`),
  `starts_at` = VALUES(`starts_at`),
  `ends_at` = VALUES(`ends_at`),
  `sale_starts_at` = VALUES(`sale_starts_at`),
  `sale_ends_at` = VALUES(`sale_ends_at`),
  `status` = VALUES(`status`);
--> statement-breakpoint
INSERT INTO `ticket_types` (`event_id`, `name`, `price`, `stock`, `sold_count`, `max_per_user`, `status`)
SELECT e.`id`, seed.`name`, seed.`price`, seed.`stock`, 0, seed.`max_per_user`, 'ACTIVE'
FROM (
  SELECT 'thadingyut-night-2026' AS `event_slug`, 'Regular' AS `name`, 15000 AS `price`, 200 AS `stock`, 4 AS `max_per_user` UNION ALL
  SELECT 'thadingyut-night-2026', 'VIP', 35000, 40, 2 UNION ALL
  SELECT 'thadingyut-night-2026', 'Early Bird', 10000, 80, 4 UNION ALL
  SELECT 'thadingyut-night-2026', 'Student', 8000, 150, 4 UNION ALL
  SELECT 'lantern-parade-2026', 'Regular', 12000, 250, 4 UNION ALL
  SELECT 'lantern-parade-2026', 'Student', 6000, 200, 4 UNION ALL
  SELECT 'lantern-parade-2026', 'VIP', 25000, 30, 2 UNION ALL
  SELECT 'thingyan-water-festival-2026', 'Regular', 18000, 300, 4 UNION ALL
  SELECT 'thingyan-water-festival-2026', 'VIP', 40000, 50, 2 UNION ALL
  SELECT 'thingyan-water-festival-2026', 'Early Bird', 12000, 100, 4 UNION ALL
  SELECT 'thingyan-water-festival-2026', 'Student', 9000, 200, 4 UNION ALL
  SELECT 'thingyan-cultural-stage-2026', 'Regular', 20000, 180, 4 UNION ALL
  SELECT 'thingyan-cultural-stage-2026', 'VIP', 50000, 30, 2 UNION ALL
  SELECT 'thingyan-cultural-stage-2026', 'Student', 10000, 120, 4 UNION ALL
  SELECT 'myanmar-night-2026', 'Regular', 25000, 250, 4 UNION ALL
  SELECT 'myanmar-night-2026', 'VIP', 60000, 40, 2 UNION ALL
  SELECT 'myanmar-night-2026', 'Early Bird', 18000, 80, 4 UNION ALL
  SELECT 'myanmar-night-2026', 'Student', 12000, 150, 4
) seed
JOIN `events` e ON e.`slug` = seed.`event_slug`
WHERE NOT EXISTS (
  SELECT 1 FROM `ticket_types` tt WHERE tt.`event_id` = e.`id` AND tt.`name` = seed.`name`
);
