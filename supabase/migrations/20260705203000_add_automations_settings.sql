-- ========================================================
-- MIGRATION: Add automations configuration to company_settings
-- ========================================================

-- Add automations column as JSONB with an empty object as default
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS automations JSONB DEFAULT '{}'::jsonb;

-- (Optional) For existing rows, ensure it's at least an empty JSON object if null
UPDATE public.company_settings 
SET automations = '{}'::jsonb 
WHERE automations IS NULL;
