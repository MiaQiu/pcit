-- Special play time offers in the module chat, non-ND parents only (no
-- learning and thinking difference reported in onboarding), counted by parent.
WITH non_nd AS (
  SELECT u.id
  FROM "User" u
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(u."screenTimeIntake"->'differences') = 'array'
           THEN u."screenTimeIntake"->'differences' ELSE '[]'::jsonb END) d
    WHERE d <> 'none'
  )
),
per_parent AS (
  SELECT o."userId",
         bool_or(o."messageId" IS NOT NULL)  AS offered,
         bool_or(o.response = 'accepted')    AS accepted,
         bool_or(o.response = 'declined')    AS declined
  FROM "SpecialPlayOffer" o
  JOIN non_nd ON non_nd.id = o."userId"
  GROUP BY o."userId"
)
SELECT
  COUNT(*) FILTER (WHERE offered)                          AS parents_offered,
  COUNT(*) FILTER (WHERE offered AND accepted)             AS accepted_after_offer,
  COUNT(*) FILTER (WHERE offered AND declined AND NOT accepted) AS declined,
  COUNT(*) FILTER (WHERE offered AND NOT accepted AND NOT declined) AS no_answer,
  COUNT(*) FILTER (WHERE accepted AND NOT offered)         AS asked_for_it_themselves
FROM per_parent;
