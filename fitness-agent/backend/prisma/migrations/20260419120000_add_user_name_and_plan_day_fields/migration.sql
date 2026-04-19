ALTER TABLE "User"
ADD COLUMN "name" TEXT NOT NULL DEFAULT '';

ALTER TABLE "WorkoutPlanDay"
ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "WorkoutPlanDay" AS day
SET "sortOrder" = ranked.position
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "workoutPlanId" ORDER BY "dayLabel" ASC) - 1 AS position
  FROM "WorkoutPlanDay"
) AS ranked
WHERE ranked."id" = day."id";
