# SQL Test Commands — Consultations & Appointments

> **✅ Ready to run!** Placeholders have been replaced with your actual IDs.
> Run these directly in the **Supabase SQL Editor**.

**Your IDs for reference:**
- Client: `3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f`
- Master: `aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b`
- Owner: `744b77f1-e94f-4918-9c04-3b9f47288377`
- Service: `13e3cd79-35cf-4d73-8093-afee87fe6a73`

---

## ➕ Insert Test Consultations

```sql
-- Insert a PENDING consultation (simulates client just submitted)
INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, how_long_ago, was_my_work, photo_urls, additional_notes)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NULL,  -- no master assigned yet
    'pending',
    true,
    '3-6 months',
    false,
    ARRAY['https://picsum.photos/400/400?random=1','https://picsum.photos/400/400?random=2']::text[],
    'Test consultation - pending status'
);

-- Insert an APPROVED consultation (simulates master/owner already approved)
INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, how_long_ago, was_my_work, photo_urls, additional_notes, responded_at, approval_expires_at)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    'approved',
    false,
    NULL,
    NULL,
    ARRAY['https://picsum.photos/400/400?random=3']::text[],
    'Test consultation - approved, ready to book',
    NOW(),
    NOW() + INTERVAL '7 days'
);

-- Insert a DECLINED consultation
INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, photo_urls, additional_notes, responded_at)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    'declined',
    true,
    ARRAY['https://picsum.photos/400/400?random=4']::text[],
    'Test consultation - declined by master',
    NOW()
);

-- Insert a CHAT_REQUESTED consultation
INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, photo_urls, additional_notes, responded_at)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    '744b77f1-e94f-4918-9c04-3b9f47288377',
    'chat_requested',
    false,
    ARRAY['https://picsum.photos/400/400?random=5']::text[],
    'Test consultation - owner wants to chat first',
    NOW()
);
```

---

## 🔄 Update Consultation Statuses

```sql
-- Approve ALL pending consultations (quick test)
UPDATE booking_consultations
SET status = 'approved',
    master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    responded_at = NOW(),
    approval_expires_at = NOW() + INTERVAL '7 days'
WHERE status = 'pending';

-- Decline ALL pending consultations
UPDATE booking_consultations
SET status = 'declined',
    master_id = '744b77f1-e94f-4918-9c04-3b9f47288377',
    responded_at = NOW()
WHERE status = 'pending';

-- Reset ALL consultations back to pending (for re-testing UI)
UPDATE booking_consultations
SET status = 'pending',
    master_id = NULL,
    responded_at = NULL,
    approval_expires_at = NULL;
```

---

## 📅 Insert Test Appointments

```sql
-- Insert a FUTURE confirmed appointment (shows in Upcoming)
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days' + INTERVAL '60 minutes',
    'confirmed',
    50.00
);

-- Insert an OVERDUE appointment (past start_time, still "confirmed")
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days' + INTERVAL '60 minutes',
    'confirmed',
    75.00
);

-- Insert a COMPLETED past appointment
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '14 days' + INTERVAL '90 minutes',
    'completed',
    120.00
);

-- Insert a CANCELLED appointment
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days' + INTERVAL '45 minutes',
    'cancelled',
    40.00
);

-- Insert appointment starting in < 24 hours (late cancellation test)
INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NOW() + INTERVAL '6 hours',
    NOW() + INTERVAL '7 hours',
    'confirmed',
    65.00
);
```

---

## 🧹 Cleanup Commands

```sql
-- Delete ALL consultations
DELETE FROM booking_consultations;

-- Delete ALL consultations for this test client
DELETE FROM booking_consultations WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f';

-- Delete ALL appointments for this test client
DELETE FROM appointments WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f';
```

---

## ⚡ Quick Scenario Scripts

```sql
-- SCENARIO: The "Mix of Everything" (Great for UI Testing)
-- Creates 1 pending, 1 approved, 1 declined + 1 upcoming + 1 past appointment all at once
DO $$
DECLARE
    v_client_id UUID := '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f';
    v_master_id UUID := 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b';
    v_service_id UUID := '13e3cd79-35cf-4d73-8093-afee87fe6a73';
BEGIN
    INSERT INTO booking_consultations (client_id, service_id, status, had_before, photo_urls, additional_notes)
    VALUES (v_client_id, v_service_id, 'pending', false, ARRAY['https://picsum.photos/400?random=201']::text[], 'Mix test - pending');

    INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, photo_urls, responded_at, approval_expires_at)
    VALUES (v_client_id, v_service_id, v_master_id, 'approved', true, ARRAY['https://picsum.photos/400?random=202']::text[], NOW(), NOW() + INTERVAL '7 days');

    INSERT INTO booking_consultations (client_id, service_id, master_id, status, had_before, photo_urls, responded_at)
    VALUES (v_client_id, v_service_id, v_master_id, 'declined', false, ARRAY['https://picsum.photos/400?random=203']::text[], NOW());

    INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
    VALUES (v_client_id, v_master_id, v_service_id, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '60 min', 'confirmed', 50);

    INSERT INTO appointments (client_id, master_id, service_id, start_time, end_time, status, price)
    VALUES (v_client_id, v_master_id, v_service_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '60 min', 'completed', 50);
END $$;
```
