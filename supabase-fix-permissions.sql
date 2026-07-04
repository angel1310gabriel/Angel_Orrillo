-- Run this in Supabase Dashboard > SQL Editor (una sola vez)
-- Restaura permisos del schema public perdidos por prisma db push --force-reset

-- 1. Permisos de esquema para anon y authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. Desactivar RLS en profiles (causa del problema)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Verificar datos
SELECT id, email, name, role FROM profiles;
