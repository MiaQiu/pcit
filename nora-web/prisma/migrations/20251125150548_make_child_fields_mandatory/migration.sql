-- Step 1: Add new columns as nullable first
ALTER TABLE "User" ADD COLUMN "childBirthYear" INTEGER;
ALTER TABLE "User" ADD COLUMN "childConditions" JSONB;

-- Step 2: Migrate existing data
-- Convert childAge to childBirthYear (current year - age)
-- For users with childAge, calculate birth year
UPDATE "User"
SET "childBirthYear" = EXTRACT(YEAR FROM CURRENT_DATE) - "childAge"
WHERE "childAge" IS NOT NULL;

-- For users without childAge, set a default birth year (e.g., 2020 for ~4-5 year old)
UPDATE "User"
SET "childBirthYear" = 2020
WHERE "childAge" IS NULL;

-- Make childName non-null with default for existing null values
UPDATE "User"
SET "childName" = 'Child'
WHERE "childName" IS NULL OR "childName" = '';

-- Convert childCondition to childConditions JSON array
-- For users with childCondition, wrap it in a JSON array
UPDATE "User"
SET "childConditions" = jsonb_build_array("childCondition")
WHERE "childCondition" IS NOT NULL AND "childCondition" != '';

-- For users without childCondition, set empty JSON array
UPDATE "User"
SET "childConditions" = '[]'::jsonb
WHERE "childCondition" IS NULL OR "childCondition" = '';

-- Step 3: Make new columns non-nullable
ALTER TABLE "User" ALTER COLUMN "childName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "childBirthYear" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "childConditions" SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE "User" DROP COLUMN "childAge";
ALTER TABLE "User" DROP COLUMN "childCondition";
