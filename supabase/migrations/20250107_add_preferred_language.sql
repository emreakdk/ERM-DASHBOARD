-- Add preferred_language column to profiles table
-- This enables users to persist their language preference across devices

-- Add the column with default value 'tr' (Turkish)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'tr' CHECK (preferred_language IN ('en', 'tr'));

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language ON profiles(preferred_language);

-- Add a comment to document the column
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language for the interface (en: English, tr: Turkish)';
