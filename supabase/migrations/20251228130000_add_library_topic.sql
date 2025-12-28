-- Add topic prompt and template type columns to content_libraries
ALTER TABLE content_libraries
ADD COLUMN IF NOT EXISTS topic_prompt TEXT,
ADD COLUMN IF NOT EXISTS template_type TEXT,
ADD COLUMN IF NOT EXISTS generate_images BOOLEAN DEFAULT FALSE;
