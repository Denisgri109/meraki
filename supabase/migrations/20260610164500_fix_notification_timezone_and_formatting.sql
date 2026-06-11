-- Update notify_new_booking function to fix timezone and format padding
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    project_url TEXT := 'https://bkxdsxnxrtcqnkdcdist.supabase.co';
    client_name TEXT;
    service_name TEXT;
    start_time_str TEXT;
    master_timezone TEXT;
BEGIN
    -- Get client name
    SELECT full_name INTO client_name FROM profiles WHERE id = NEW.client_id;
    
    -- Get service name
    SELECT name INTO service_name FROM services WHERE id = NEW.service_id;
    
    -- Get master timezone (fallback to Europe/London)
    SELECT timezone INTO master_timezone FROM profiles WHERE id = NEW.master_id;
    master_timezone := COALESCE(master_timezone, 'Europe/London');
    
    -- Format time using FM to remove padding spaces and using the local timezone
    start_time_str := to_char(NEW.start_time AT TIME ZONE master_timezone, 'FMDay, HH12:MI AM');
    
    -- Notify the Master
    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'user_id', NEW.master_id,
            'title', '📅 New Booking',
            'body', format('New Booking: %s for %s on %s', COALESCE(client_name, 'A client'), COALESCE(service_name, 'a service'), start_time_str),
            'data', jsonb_build_object('type', 'new_booking', 'appointment_id', NEW.id),
            'preference_key', 'booking_updates'
        )
    );
    
    -- Notify all Owners
    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'user_id', owner.id,
            'title', '📅 New Booking',
            'body', format('New Booking: %s for %s on %s', COALESCE(client_name, 'A client'), COALESCE(service_name, 'a service'), start_time_str),
            'data', jsonb_build_object('type', 'new_booking', 'appointment_id', NEW.id),
            'preference_key', 'booking_updates'
        )
    ) FROM profiles AS owner WHERE owner.role = 'owner' AND owner.id != NEW.master_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to send new booking notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Update notify_cancellation function to fix timezone and format padding
CREATE OR REPLACE FUNCTION public.notify_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    project_url TEXT := 'https://bkxdsxnxrtcqnkdcdist.supabase.co';
    client_name TEXT;
    start_time_str TEXT;
    master_timezone TEXT;
BEGIN
    -- Only trigger when status changes TO 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        SELECT full_name INTO client_name FROM profiles WHERE id = NEW.client_id;
        
        -- Get master timezone (fallback to Europe/London)
        SELECT timezone INTO master_timezone FROM profiles WHERE id = NEW.master_id;
        master_timezone := COALESCE(master_timezone, 'Europe/London');
        
        start_time_str := to_char(NEW.start_time AT TIME ZONE master_timezone, 'FMDay, FMMon DD');
        
        -- Notify the Master
        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-notification',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
                'user_id', NEW.master_id,
                'title', '❌ Booking Cancelled',
                'body', format('Booking Cancelled: %s has cancelled their %s appointment.', COALESCE(client_name, 'A client'), start_time_str),
                'data', jsonb_build_object('type', 'cancellation', 'appointment_id', NEW.id),
                'preference_key', 'booking_updates'
            )
        );
        
        -- Notify all Owners
        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-notification',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
                'user_id', owner.id,
                'title', '❌ Booking Cancelled',
                'body', format('Booking Cancelled: %s has cancelled their %s appointment.', COALESCE(client_name, 'A client'), start_time_str),
                'data', jsonb_build_object('type', 'cancellation', 'appointment_id', NEW.id),
                'preference_key', 'booking_updates'
            )
        ) FROM profiles AS owner WHERE owner.role = 'owner' AND owner.id != NEW.master_id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to send cancellation notification: %', SQLERRM;
        RETURN NEW;
END;
$$;
