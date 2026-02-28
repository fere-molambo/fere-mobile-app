/*
  # Migrate weekly_availability from French to English day keys

  1. Changes
    - Converts French day names (lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche)
      to English equivalents (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
      in the `weekly_availability` JSONB column of the `services` table
    - Only affects rows where French keys are present
    - Preserves all time slot data within each day

  2. Important Notes
    - This is a non-destructive data transformation
    - Only updates rows that contain French-keyed availability data
    - English-keyed data is left untouched
*/

UPDATE services
SET weekly_availability = (
  SELECT jsonb_object_agg(
    CASE key
      WHEN 'lundi' THEN 'monday'
      WHEN 'mardi' THEN 'tuesday'
      WHEN 'mercredi' THEN 'wednesday'
      WHEN 'jeudi' THEN 'thursday'
      WHEN 'vendredi' THEN 'friday'
      WHEN 'samedi' THEN 'saturday'
      WHEN 'dimanche' THEN 'sunday'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(weekly_availability)
)
WHERE weekly_availability IS NOT NULL
  AND weekly_availability != '{}'::jsonb
  AND weekly_availability ? 'lundi';
