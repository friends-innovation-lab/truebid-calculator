-- ============================================================================
-- Add writing_guide JSONB column to company_settings
-- ============================================================================

-- Add the writing_guide column with default empty object
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS writing_guide JSONB DEFAULT '{}';

-- Add comment describing the expected shape
COMMENT ON COLUMN company_settings.writing_guide IS 'FFTC Writing Guide configuration: {
  voice_description: string,
  reading_level: string,
  sentence_rules: string[],
  words_to_avoid: string[],
  words_to_use: string[],
  structural_rules: string[],
  example_sentences: string[]
}';
