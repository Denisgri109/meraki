-- Create storage bucket for consultation photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consultation-photos', 'consultation-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload consultation photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'consultation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read (bucket is public)
CREATE POLICY "Public can view consultation photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'consultation-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own consultation photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'consultation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
