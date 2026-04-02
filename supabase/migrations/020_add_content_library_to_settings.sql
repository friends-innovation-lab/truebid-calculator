-- ============================================================================
-- Add content_library JSONB column to company_settings
-- ============================================================================

-- Add the content_library column with default empty object
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS content_library JSONB DEFAULT '{}';

-- Add comment describing the expected shape
COMMENT ON COLUMN company_settings.content_library IS 'Content library for proposals: {
  pastPerformance: [...],
  standardApproaches: [...]
}';
