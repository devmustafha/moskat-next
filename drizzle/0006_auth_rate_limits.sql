CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- Better Auth counts sign-in attempts here and deletes expired rows itself.
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO moskat_app;
