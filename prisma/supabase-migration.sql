-- ============================================================
-- KC Cobranzas - Supabase SQL Migration
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- to add the `role` column to the `profiles` table.
--
-- The Flutter mobile app may not create this column automatically,
-- but the web admin panel needs it for authorization.
-- ============================================================

-- 1. Add the role column if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'collector';

-- 2. Add the is_active column if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Set your admin user(s) role to 'admin'
--    Replace the email with your actual admin email
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'keysy@gmail.com'  -- CHANGE THIS to your admin email
  AND (role IS NULL OR role = '' OR role = 'collector');

-- 4. Set the first registered user as admin if no admin exists
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE role = 'admin'
);

-- 5. Show the updated profiles
SELECT id, email, name, role, is_active FROM public.profiles ORDER BY created_at ASC;
