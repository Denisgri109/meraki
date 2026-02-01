-- Add reschedule_initiated_by column to appointments table
-- This tracks who initiated the reschedule request (client or master)

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reschedule_initiated_by uuid REFERENCES profiles(id);

-- Add comment for documentation
COMMENT ON COLUMN appointments.reschedule_initiated_by IS 'User ID of who initiated the reschedule request';
