-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Disable RLS temporarily on profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Create profiles for the two auth users
INSERT INTO profiles (id, email, name, role, is_active, created_at)
VALUES 
  ('7e79c902-a74b-4358-b335-b1ca37a453ae', 'keysyotero@gmail.com', 'Keysy Otero', 'admin', true, now()),
  ('5d4b78e2-f732-44f1-a5e6-d6caf75903f1', 'angelorrillo1@gmail.com', 'Angel Orrillo', 'collector', true, now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 3. Re-enable RLS with permissive policy
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policy: allow authenticated users to read all profiles
DROP POLICY IF EXISTS "allow_read_profiles" ON profiles;
CREATE POLICY "allow_read_profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Policy: allow users to update their own profile
DROP POLICY IF EXISTS "allow_update_own_profile" ON profiles;
CREATE POLICY "allow_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);