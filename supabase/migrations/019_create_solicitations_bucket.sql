-- Create solicitations storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'solicitations',
  'solicitations',
  true,
  26214400, -- 25MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf'];

-- Allow authenticated users to upload PDFs to their company's folder
CREATE POLICY "Users can upload PDFs to their company folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'solicitations' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Allow authenticated users to read PDFs from their company's folder
CREATE POLICY "Users can read PDFs from their company folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'solicitations' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Allow public read access (since bucket is public for viewing in browser)
CREATE POLICY "Public read access for solicitations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'solicitations');

-- Allow authenticated users to delete their company's PDFs
CREATE POLICY "Users can delete PDFs from their company folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'solicitations' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);
