-- ============================================
-- Cron Jobs for Automated Notifications & Reminders
-- ============================================
-- Created: 2026-02-04
-- Updated: 2026-02-23
-- Purpose: Schedule all automated notification Edge Functions
--
-- PREREQUISITES (run once via Supabase Dashboard > SQL Editor):
--   1. Enable extensions: pg_cron and pg_net
--      CREATE EXTENSION IF NOT EXISTS pg_cron;
--      CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Store the service role key in Supabase Vault:
--      SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY_HERE', 'service_role_key');
--
-- To check vault secret: SELECT * FROM vault.decrypted_secrets WHERE name = 'service_role_key';
-- To update vault secret: 
--   DELETE FROM vault.secrets WHERE name = 'service_role_key';
--   SELECT vault.create_secret('NEW_KEY', 'service_role_key');
-- ============================================

-- Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. HELPER FUNCTION: Invoke Edge Functions securely
-- ============================================
-- Reads the service role key from Supabase Vault at call time.
-- Usage: SELECT invoke_edge_function('function-name');
--        SELECT invoke_edge_function('function-name', '{"key": "value"}'::jsonb);

CREATE OR REPLACE FUNCTION invoke_edge_function(
    function_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT AS $$
DECLARE
    _service_role_key TEXT;
    _project_url TEXT := 'https://bkxdsxnxrtcqnkdcdist.supabase.co';
    _request_id BIGINT;
BEGIN
    -- Retrieve service role key from Supabase Vault
    SELECT decrypted_secret INTO _service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    IF _service_role_key IS NULL THEN
        RAISE WARNING 'Service role key not found in vault. Run: SELECT vault.create_secret(''YOUR_KEY'', ''service_role_key'');';
        RETURN NULL;
    END IF;

    SELECT net.http_post(
        url := _project_url || '/functions/v1/' || function_name,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_role_key
        ),
        body := payload
    ) INTO _request_id;

    RETURN _request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. UNSCHEDULE ANY EXISTING JOBS (idempotent re-runs)
-- ============================================

SELECT cron.unschedule('appointment-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders');

SELECT cron.unschedule('aftercare-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aftercare-reminders');

SELECT cron.unschedule('process-campaigns')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-campaigns');

SELECT cron.unschedule('send-confirmation-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-confirmation-reminders');

SELECT cron.unschedule('auto-cancel-no-response')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-cancel-no-response');

SELECT cron.unschedule('auto-charge-grace-period')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-charge-grace-period');

SELECT cron.unschedule('low-stock-alert')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'low-stock-alert');

-- ============================================
-- 3. SCHEDULE ALL CRON JOBS
-- ============================================

-- 3a. APPOINTMENT REMINDERS — every 15 minutes
-- Sends 24-hour and 1-hour push notification reminders to clients
SELECT cron.schedule(
    'appointment-reminders',
    '*/15 * * * *',
    $$SELECT invoke_edge_function('appointment-reminders')$$
);

-- 3b. AFTERCARE REMINDERS — every hour at minute 0
-- Sends aftercare tips to clients after completed appointments
-- (e.g., lash care reminders, nail care tips) based on master campaigns or defaults
SELECT cron.schedule(
    'aftercare-reminders',
    '0 * * * *',
    $$SELECT invoke_edge_function('aftercare-reminder')$$
);

-- 3c. PROCESS CAMPAIGNS — daily at 10:00 AM UTC
-- Broadcasts promotion, vacation, and announcement campaigns to master's clients
SELECT cron.schedule(
    'process-campaigns',
    '0 10 * * *',
    $$SELECT invoke_edge_function('process-campaigns')$$
);

-- 3d. CONFIRMATION REMINDERS — every 15 minutes
-- Sends push/email reminders to clients who haven't confirmed upcoming appointments
SELECT cron.schedule(
    'send-confirmation-reminders',
    '*/15 * * * *',
    $$SELECT invoke_edge_function('send-confirmation-reminder')$$
);

-- 3e. AUTO-CANCEL NO RESPONSE — every 15 minutes
-- Cancels appointments and releases Stripe holds when clients never confirm
SELECT cron.schedule(
    'auto-cancel-no-response',
    '*/15 * * * *',
    $$SELECT invoke_edge_function('auto-cancel-no-response')$$
);

-- 3f. AUTO-CHARGE GRACE PERIOD — every 5 minutes
-- Charges no-show fees for appointments where grace period has expired
SELECT cron.schedule(
    'auto-charge-grace-period',
    '*/5 * * * *',
    $$SELECT invoke_edge_function('auto-charge-grace-period')$$
);

-- 3g. LOW STOCK ALERT — daily at 9:00 AM UTC
-- Notifies owners/admins when product stock falls below threshold
SELECT cron.schedule(
    'low-stock-alert',
    '0 9 * * *',
    $$SELECT invoke_edge_function('low-stock-alert')$$
);

-- ============================================
-- 4. VERIFICATION
-- ============================================
-- After running this migration, verify jobs are scheduled:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
--
-- To monitor execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- To test a single function manually:
-- SELECT invoke_edge_function('appointment-reminders');
