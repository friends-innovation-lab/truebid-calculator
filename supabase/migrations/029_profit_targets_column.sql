-- Add profit_targets JSONB column to company_settings
-- Stores per-contract-type profit margins: { tm, ffp, gsa, ... }
--
-- ROLLBACK:
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS profit_targets;

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS profit_targets JSONB DEFAULT '{
  "tm": 0.08,
  "ffp": 0.10,
  "cpff": 0.08,
  "cpif": 0.10,
  "hybrid": 0.10,
  "gsa": 0.08
}'::JSONB;

COMMENT ON COLUMN company_settings.profit_targets IS
  'Profit margin targets by contract type (decimal). FFP default is 10% (Low risk). Medium (12%) and High (15%) require explicit selection.';
