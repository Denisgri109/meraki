# SQL Test Commands - Rating System Testing

> **Important:** the current generated schema in this repo does **not** expose a dedicated `reviews` or `ratings` table yet.
> This file is still ready to run in the **Supabase SQL Editor**, but it is focused on two things:
> 1. Verifying whether your live Supabase project already has a ratings backend that is missing from local generated types.
> 2. Creating completed appointment data that the client-side rating flow would usually depend on before a user can leave a review.

**Your IDs for reference:**
- Client: `3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f`
- Master: `aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b`
- Owner: `744b77f1-e94f-4918-9c04-3b9f47288377`
- Service: `13e3cd79-35cf-4d73-8093-afee87fe6a73`

---

## 🔍 Verify Whether A Ratings Backend Exists

```sql
-- Find any tables whose names look related to ratings or reviews
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%rating%'
    OR table_name ILIKE '%review%'
  )
ORDER BY table_name;

-- Find any public columns that look related to ratings/reviews/comments
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%rating%'
    OR column_name ILIKE '%review%'
    OR column_name ILIKE '%comment%'
    OR column_name ILIKE '%feedback%'
    OR column_name ILIKE '%stars%'
  )
ORDER BY table_name, ordinal_position;

-- Helpful one-shot notice in SQL Editor
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        table_name ILIKE '%rating%'
        OR table_name ILIKE '%review%'
        OR column_name ILIKE '%rating%'
        OR column_name ILIKE '%review%'
      );

    IF v_count = 0 THEN
        RAISE NOTICE 'No ratings/reviews schema found in public.* right now.';
    ELSE
        RAISE NOTICE 'Found % rating/review-related schema entries. Check the result sets above.', v_count;
    END IF;
END $$;
```

---

## ✅ Insert Completed Appointments For Rating Flow Testing

```sql
-- Insert a freshly completed appointment (best candidate for a "Rate Experience" CTA)
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '7 hours',
    'completed',
    111.11
);

-- Insert an older completed appointment for history testing
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '14 days' + INTERVAL '75 minutes',
    'completed',
    222.22
);

-- Insert a no-show appointment to verify it does NOT behave like a reviewable completion
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '60 minutes',
    'no_show',
    333.33
);

-- Insert a cancelled appointment to verify it does NOT behave like a reviewable completion
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days' + INTERVAL '60 minutes',
    'cancelled',
    444.44
);
```

---

## 🔄 Update Appointment States For Rating Re-Testing

```sql
-- Convert this client's latest confirmed appointment into a completed one
UPDATE appointments
SET status = 'completed'
WHERE id = (
    SELECT id
    FROM appointments
    WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
      AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
      AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
      AND status = 'confirmed'
    ORDER BY start_time DESC
    LIMIT 1
);

-- Reset the synthetic rating-test appointments back to confirmed if you want to replay the completion flow
UPDATE appointments
SET status = 'confirmed'
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND price IN (111.11, 222.22);

-- Set them back to completed again for the rating screen / CTA test
UPDATE appointments
SET status = 'completed'
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND price IN (111.11, 222.22);
```

---

## 📊 Inspect Data The Rating Flow Would Depend On

```sql
-- Review the candidate appointments the app could use for rating prompts
SELECT id, client_id, master_id, service_id, start_time, end_time, status, price, created_at
FROM appointments
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
ORDER BY start_time DESC;

-- Focus only on completed appointments that would usually be reviewable
SELECT id, start_time, end_time, status, price
FROM appointments
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND status = 'completed'
ORDER BY start_time DESC;

-- If you suspect there IS a review table in your remote DB, rerun the schema check after any migration
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%review%'
    OR table_name ILIKE '%rating%'
    OR column_name ILIKE '%review%'
    OR column_name ILIKE '%rating%'
  )
ORDER BY table_name, ordinal_position;
```

---

## 🧹 Cleanup Commands

```sql
-- Delete only the synthetic rating-test appointments from this file
DELETE FROM appointments
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND price IN (111.11, 222.22, 333.33, 444.44);

-- Broad cleanup for all completed appointments for this client/service/master
DELETE FROM appointments
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND status = 'completed';
```

---

## ⚡ Quick Scenario Script

```sql
-- SCENARIO: Create one reviewable appointment and immediately verify whether a ratings backend exists
DO $$
DECLARE
    v_has_rating_schema BOOLEAN;
BEGIN
    INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
    VALUES (
        '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
        'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
        '13e3cd79-35cf-4d73-8093-afee87fe6a73',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day' + INTERVAL '60 minutes',
        'completed',
        555.55
    );

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            table_name ILIKE '%review%'
            OR table_name ILIKE '%rating%'
            OR column_name ILIKE '%review%'
            OR column_name ILIKE '%rating%'
          )
    ) INTO v_has_rating_schema;

    IF v_has_rating_schema THEN
        RAISE NOTICE 'Completed appointment created. A ratings/reviews schema appears to exist in this project.';
    ELSE
        RAISE NOTICE 'Completed appointment created, but no ratings/reviews schema was detected.';
    END IF;
END $$;
```