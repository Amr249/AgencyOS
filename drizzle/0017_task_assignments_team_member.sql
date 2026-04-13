-- task_assignments: assign by team_member_id (no login required), not users.id
ALTER TABLE "task_assignments" ADD COLUMN "team_member_id" uuid;
--> statement-breakpoint
UPDATE "task_assignments" AS ta
SET "team_member_id" = tm.id
FROM "users" AS u
INNER JOIN "team_members" AS tm ON lower(trim(coalesce(tm.email, ''))) = lower(trim(coalesce(u.email, '')))
  AND length(trim(coalesce(tm.email, ''))) > 0
WHERE ta."user_id" = u.id AND ta."team_member_id" IS NULL;
--> statement-breakpoint
DELETE FROM "task_assignments" WHERE "team_member_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "task_assignments" DROP CONSTRAINT "task_assignments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "task_assignments" DROP COLUMN "user_id";
--> statement-breakpoint
ALTER TABLE "task_assignments" ALTER COLUMN "team_member_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_assignments_task_team_unique" ON "task_assignments" ("task_id", "team_member_id");
