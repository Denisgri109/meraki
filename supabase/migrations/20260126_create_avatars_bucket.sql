-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Note: You might need to drop existing policies if rerunning or conflict handling is needed, but for now we assume fresh or manual handling of conflicts manually if errors occur.

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Random upload for avatars"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Update own avatar"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' );
