import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, collections } from '@/lib/firestore-db';

export async function GET() {
  try {
    const companies = await findMany(collections.companies, undefined, { field: 'name', direction: 'asc' });
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

    const existing = await findFirst(collections.companies, { slug });
    if (existing) {
      return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 409 });
    }

    const company = await createDoc(collections.companies, { name, slug });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies error:', error);
    return NextResponse.json({ error: 'Error al crear compañía' }, { status: 500 });
  }
}
