import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('name');

        if (!error && data) {
          return NextResponse.json(data);
        }
      }
    } catch {}

    // Fallback: Prisma
    const companies = await db.company.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(companies);
  } catch (error) {
    console.error('GET /api/companies error:', error);
    return NextResponse.json({ error: 'Error al obtener compañías' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Se requieren name y slug' }, { status: 400 });
    }

    try {
      const supabase = await getSupabase();
      if (supabase) {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 409 });
        }

        const { data, error } = await supabase
          .from('companies')
          .insert({ name, slug })
          .select('*')
          .single();

        if (!error && data) {
          return NextResponse.json(data, { status: 201 });
        }
      }
    } catch {}

    // Fallback: Prisma
    const existing = await db.company.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 409 });
    }

    const company = await db.company.create({
      data: { name, slug },
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies error:', error);
    return NextResponse.json({ error: 'Error al crear compañía' }, { status: 500 });
  }
}

async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {}
  return null;
}
