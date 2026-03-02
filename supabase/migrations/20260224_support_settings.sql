-- Migration: Add support settings columns to master_settings
-- These columns allow the owner to configure support contact details
-- shown to clients on the Help & Support page.

ALTER TABLE master_settings
ADD COLUMN IF NOT EXISTS support_phone TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_reply_message TEXT DEFAULT NULL;

COMMENT ON COLUMN master_settings.support_phone IS 'Support phone number displayed to clients on Help & Support';
COMMENT ON COLUMN master_settings.support_email IS 'Support email address displayed to clients on Help & Support';
COMMENT ON COLUMN master_settings.auto_reply_message IS 'Auto-reply message sent to clients who initiate a support chat';
