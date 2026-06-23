ALTER TABLE `flashcard_decks` ADD `description` text;--> statement-breakpoint
ALTER TABLE `flashcard_decks` ADD `isPublic` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `flashcard_decks` ADD `shareSlug` varchar(128);--> statement-breakpoint
ALTER TABLE `flashcard_decks` ADD `subject` varchar(128);--> statement-breakpoint
ALTER TABLE `flashcard_decks` ADD `cardCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `isPublic` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `shareSlug` varchar(128);--> statement-breakpoint
ALTER TABLE `notes` ADD `subject` varchar(128);--> statement-breakpoint
ALTER TABLE `flashcard_decks` ADD CONSTRAINT `flashcard_decks_shareSlug_unique` UNIQUE(`shareSlug`);--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_shareSlug_unique` UNIQUE(`shareSlug`);