-- Migration: Expire Reschedule Requests
-- Created: 2026-02-12
-- Purpose: Automatically cancel appointments with pending reschedule requests that have expired.

-- Function to handle expiration
CREATE OR REPLACE FUNCTION handle_reschedule_expiration() RETURNS void AS $$
DECLARE
    expired_count integer;
BEGIN
    WITH expired_updates AS (
        UPDATE appointments
        SET 
            status = 'cancelled',
            updated_at = NOW(),
            notes = COALESCE(notes, '') || E'\n[System] Reschedule request expired and appointment cancelled.'
        WHERE
            status = 'reschedule_pending'
            AND (
                -- Case 1: Urgent (Proposed time is within 24h of when request was made)
                -- Logic: If start time is close, give them less time (3 hours)
                (
                    (proposed_start_time - COALESCE(status_updated_at, updated_at)) < interval '24 hours' 
                    AND NOW() > (COALESCE(status_updated_at, updated_at) + interval '3 hours')
                )
                OR
                -- Case 2: Standard (Proposed time is >= 24h away)
                -- Logic: Give them 24 hours to respond
                (
                    (proposed_start_time - COALESCE(status_updated_at, updated_at)) >= interval '24 hours' 
                    AND NOW() > (COALESCE(status_updated_at, updated_at) + interval '24 hours')
                )
            )
        RETURNING id
    )
    SELECT count(*) INTO expired_count FROM expired_updates;

    IF expired_count > 0 THEN
        RAISE NOTICE 'Expired % appointment reschedule requests.', expired_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job to run every 30 minutes
-- Note: 'expire_reschedules_job' is a unique name for this cron job
SELECT cron.schedule(
    'expire_reschedules_job',
    '*/30 * * * *', 
    'SELECT handle_reschedule_expiration()'
);
