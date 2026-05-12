# SQL Test Commands - Q&A / Consultation Questions

> **Ready to run.** Placeholders have been replaced with your actual IDs.
> Run these directly in the **Supabase SQL Editor**.
> The current mobile booking flow writes consultation questionnaire submissions to `booking_consultations`. The `consultation_responses` table also exists and can be seeded separately for broader Q&A testing.

**Your IDs for reference:**
- Client: `3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f`
- Master: `aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b`
- Owner: `744b77f1-e94f-4918-9c04-3b9f47288377`
- Service: `13e3cd79-35cf-4d73-8093-afee87fe6a73`

---

## ➕ Enable Test Q&A On The Service

```sql
-- Turn consultation mode ON for this service and attach test questions
UPDATE services
SET requires_consultation = true,
    consultation_questions = '[
      "Have you had this service before?",
      "How long ago was your last appointment?",
      "Was the previous work done by this master?",
      "Do you have any allergies or sensitivities?",
      "Are you currently taking any medication that may affect healing?",
      "Anything else the specialist should know before approving?"
    ]'::jsonb,
    updated_at = NOW()
WHERE id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';

-- Verify the Q&A payload on the service
SELECT id, name, requires_consultation, consultation_questions
FROM services
WHERE id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';
```

---

## 📝 Insert Test Q&A Requests Into booking_consultations

```sql
-- Insert a PENDING Q&A request
INSERT INTO booking_consultations (
    client_id,
    service_id,
    master_id,
    status,
    had_before,
    how_long_ago,
    was_my_work,
    photo_urls,
    additional_notes
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    NULL,
    'pending',
    true,
    '3-6 months',
    false,
    ARRAY[
      'https://picsum.photos/400/400?random=301',
      'https://picsum.photos/400/400?random=302'
    ]::text[],
    'Q&A test - pending. Client reports previous work from another artist, mild sensitivity, and wants approval before booking.'
);

-- Insert an APPROVED Q&A request
INSERT INTO booking_consultations (
    client_id,
    service_id,
    master_id,
    status,
    had_before,
    how_long_ago,
    was_my_work,
    photo_urls,
    additional_notes,
    master_notes,
    responded_at,
    approval_expires_at
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    'approved',
    false,
    NULL,
    NULL,
    ARRAY['https://picsum.photos/400/400?random=303']::text[],
    'Q&A test - approved. No prior work, no allergies, client ready to proceed.',
    'Approved after reviewing photos and notes. Safe to continue to booking.',
    NOW(),
    NOW() + INTERVAL '7 days'
);

-- Insert a DECLINED Q&A request
INSERT INTO booking_consultations (
    client_id,
    service_id,
    master_id,
    status,
    had_before,
    how_long_ago,
    was_my_work,
    photo_urls,
    additional_notes,
    master_notes,
    responded_at
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    'declined',
    true,
    '1-3 months',
    true,
    ARRAY['https://picsum.photos/400/400?random=304']::text[],
    'Q&A test - declined. Client reports recent irritation and wants treatment immediately.',
    'Declined for now. Recommend waiting until the skin barrier has fully recovered.',
    NOW()
);

-- Insert a CHAT_REQUESTED Q&A request
INSERT INTO booking_consultations (
    client_id,
    service_id,
    master_id,
    status,
    had_before,
    how_long_ago,
    was_my_work,
    photo_urls,
    additional_notes,
    master_notes,
    responded_at
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    '744b77f1-e94f-4918-9c04-3b9f47288377',
    'chat_requested',
    true,
    '6-12 months',
    false,
    ARRAY['https://picsum.photos/400/400?random=305']::text[],
    'Q&A test - chat requested. Client answered yes to previous work and listed medication concerns.',
    'Please chat with the client before approving. Need clarification on medication and aftercare.',
    NOW()
);
```

---

## 📋 Insert Generic Q&A Answer Sets Into consultation_responses

```sql
-- Insert a completed Q&A answer set reviewed by the assigned master
INSERT INTO consultation_responses (
    client_id,
    master_id,
    service_id,
    has_had_before,
    time_since_last,
    was_with_this_master,
    additional_answers,
    consultation_required,
    consultation_completed,
    consultation_notes
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    true,
    '6_to_12_months',
    false,
    '{
      "allergies": "Latex sensitivity only",
      "medication": "None",
      "pregnancy": "No",
      "extra_notes": "Wants a softer shape this time"
    }'::jsonb,
    true,
    true,
    'Completed Q&A review. Suitable for service with updated styling plan.'
);

-- Insert a Q&A answer set that still needs follow-up
INSERT INTO consultation_responses (
    client_id,
    master_id,
    service_id,
    has_had_before,
    time_since_last,
    was_with_this_master,
    additional_answers,
    consultation_required,
    consultation_completed,
    consultation_notes
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    '744b77f1-e94f-4918-9c04-3b9f47288377',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    true,
    'less_than_6_months',
    false,
    '{
      "allergies": "Unknown",
      "medication": "Retinol",
      "pregnancy": "No",
      "extra_notes": "Owner wants a follow-up chat before approval"
    }'::jsonb,
    true,
    false,
    'Needs follow-up before this Q&A can be marked complete.'
);

-- Insert a simple first-time client Q&A answer set
INSERT INTO consultation_responses (
    client_id,
    master_id,
    service_id,
    has_had_before,
    time_since_last,
    was_with_this_master,
    additional_answers,
    consultation_required,
    consultation_completed,
    consultation_notes
)
VALUES (
    '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f',
    'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    '13e3cd79-35cf-4d73-8093-afee87fe6a73',
    false,
    'never',
    NULL,
    '{
      "allergies": "None",
      "medication": "None",
      "pregnancy": "No",
      "extra_notes": "First-time client, wants a natural result"
    }'::jsonb,
    true,
    true,
    'Good baseline Q&A for first-time consultation testing.'
);
```

---

## 🔄 Update Q&A States For Re-Testing

```sql
-- Approve all pending booking Q&A requests
UPDATE booking_consultations
SET status = 'approved',
    master_id = 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b',
    master_notes = 'Bulk-approved for UI testing.',
    responded_at = NOW(),
    approval_expires_at = NOW() + INTERVAL '7 days'
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
  AND status = 'pending';

-- Mark all consultation_responses for this client/service as completed
UPDATE consultation_responses
SET consultation_completed = true,
    consultation_notes = COALESCE(consultation_notes, '') || ' [Marked complete for testing]',
    updated_at = NOW()
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';

-- Reset booking Q&A requests back to pending
UPDATE booking_consultations
SET status = 'pending',
    master_id = NULL,
    master_notes = NULL,
    responded_at = NULL,
    approval_expires_at = NULL
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';
```

---

## 🔍 View The Q&A Data

```sql
-- Check the service-level questions
SELECT id, name, requires_consultation, consultation_questions
FROM services
WHERE id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';

-- Check booking Q&A submissions in newest-first order
SELECT id, status, client_id, master_id, had_before, how_long_ago, was_my_work, additional_notes, master_notes, responded_at, created_at
FROM booking_consultations
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
ORDER BY created_at DESC;

-- Check generic consultation answer records
SELECT id, client_id, master_id, service_id, has_had_before, time_since_last, was_with_this_master, additional_answers, consultation_required, consultation_completed, consultation_notes, created_at
FROM consultation_responses
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73'
ORDER BY created_at DESC;
```

---

## 🧹 Cleanup Commands

```sql
-- Delete all generic Q&A answer records for this client/service
DELETE FROM consultation_responses
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';

-- Delete all booking Q&A requests for this client/service
DELETE FROM booking_consultations
WHERE client_id = '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f'
  AND service_id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';

-- Turn consultation mode OFF for this service
UPDATE services
SET requires_consultation = false,
    consultation_questions = NULL,
    updated_at = NOW()
WHERE id = '13e3cd79-35cf-4d73-8093-afee87fe6a73';
```

---

## ⚡ Quick Scenario Script

```sql
-- SCENARIO: Full Q&A setup in one run
DO $$
DECLARE
    v_client_id UUID := '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f';
    v_master_id UUID := 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b';
    v_owner_id UUID := '744b77f1-e94f-4918-9c04-3b9f47288377';
    v_service_id UUID := '13e3cd79-35cf-4d73-8093-afee87fe6a73';
BEGIN
    UPDATE services
    SET requires_consultation = true,
        consultation_questions = '[
          "Have you had this service before?",
          "How long ago was your last appointment?",
          "Was the previous work done by this master?",
          "Do you have any allergies or sensitivities?",
          "Are you taking any medication that may affect healing?",
          "Anything else the specialist should know before approving?"
        ]'::jsonb,
        updated_at = NOW()
    WHERE id = v_service_id;

    INSERT INTO booking_consultations (
        client_id,
        service_id,
        status,
        had_before,
        how_long_ago,
        was_my_work,
        photo_urls,
        additional_notes
    )
    VALUES (
        v_client_id,
        v_service_id,
        'pending',
        true,
        '3-6 months',
        false,
        ARRAY['https://picsum.photos/400?random=399']::text[],
        'Quick Q&A scenario - pending request'
    );

    INSERT INTO booking_consultations (
        client_id,
        service_id,
        master_id,
        status,
        had_before,
        photo_urls,
        additional_notes,
        master_notes,
        responded_at,
        approval_expires_at
    )
    VALUES (
        v_client_id,
        v_service_id,
        v_master_id,
        'approved',
        false,
        ARRAY['https://picsum.photos/400?random=400']::text[],
        'Quick Q&A scenario - approved request',
        'Approved for booking test.',
        NOW(),
        NOW() + INTERVAL '7 days'
    );

    INSERT INTO consultation_responses (
        client_id,
        master_id,
        service_id,
        has_had_before,
        time_since_last,
        was_with_this_master,
        additional_answers,
        consultation_required,
        consultation_completed,
        consultation_notes
    )
    VALUES (
        v_client_id,
        v_owner_id,
        v_service_id,
        true,
        'over_1_year',
        false,
        '{"allergies":"None","medication":"None","extra_notes":"Bulk scenario record"}'::jsonb,
        true,
        true,
        'Quick scenario complete.'
    );
END $$;
```