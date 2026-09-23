-- =============================================================================
-- BOYD'S Logistics LLC — 0026 the private document store
--
-- LAUNCH BLOCKER FIX. Proof of delivery, signatures and job photos are uploaded
-- with the signed-in user's own session, so they are subject to row level
-- security on storage.objects. Supabase enables that security on every project
-- and ships no policies — and until now no BOYD'S migration created the bucket
-- or a single storage policy. On a real project every upload from the van would
-- have been refused, and since proof of delivery is required before a job can
-- reach POD_RECEIVED, no job could have been completed.
--
-- The earlier test harness had no storage schema at all, so nothing noticed.
-- tests/integration/document-storage.test.ts now exercises these policies.
--
-- The rules mirror the `documents` table (migration 0017):
--   * partners may read and manage every file in the bucket;
--   * a driver may upload to, and read, only the folder of a job assigned to
--     them — `jobs/<job id>/...`, the path the driver app writes;
--   * nobody else, and nothing anonymous, reaches the bucket at all.
--
-- Deliberately NOT done: `alter table storage.objects enable row level
-- security`. Supabase already enables it, and storage.objects is owned by
-- Supabase's storage role, so that statement fails on a hosted project.
-- =============================================================================

-- --- The bucket --------------------------------------------------------------
--
-- Private, with the same limits the application enforces: 25 MB, and only the
-- file types the driver app accepts. If the bucket was created by hand in the
-- dashboard beforehand, this corrects it rather than trusting it — above all,
-- it cannot be left public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'boyds-documents',
  'boyds-documents',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --- Partners: everything in the bucket --------------------------------------

create policy boyds_documents_partner
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'boyds-documents' and is_partner())
  with check (bucket_id = 'boyds-documents' and is_partner());

-- --- Drivers: only the folders of their own jobs -----------------------------
--
-- The job id is compared as text rather than cast to uuid, so a malformed path
-- is simply not matched instead of raising an error mid-query.

create policy boyds_documents_driver_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'boyds-documents'
    and is_driver()
    and (storage.foldername(name))[1] = 'jobs'
    and (storage.foldername(name))[2] in (
      select j.id::text
      from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  );

create policy boyds_documents_driver_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'boyds-documents'
    and is_driver()
    and (storage.foldername(name))[1] = 'jobs'
    and (storage.foldername(name))[2] in (
      select j.id::text
      from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  );

-- No update or delete policy for drivers. A filed proof of delivery is not the
-- driver's to replace or remove, which matches the documents table.
