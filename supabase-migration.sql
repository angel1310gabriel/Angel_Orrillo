-- Add rest_days column to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rest_days TEXT DEFAULT '';

-- Create caja_movements table for cash register module
CREATE TABLE IF NOT EXISTS caja_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create companies table for multi-tenant support
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_caja_movements_type ON caja_movements(type);
CREATE INDEX IF NOT EXISTS idx_caja_movements_created_at ON caja_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_caja_movements_category ON caja_movements(category);
