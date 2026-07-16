import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, updateDoc, deleteMany, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      const setting = await findFirst(collections.settings, { key });
      if (!setting) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      return NextResponse.json(setting);
    }

    const settings = await findMany(collections.settings);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener configuraciones' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key y value son requeridos' }, { status: 400 });
    }

    const existing = await findFirst(collections.settings, { key });
    if (existing) {
      await updateDoc(collections.settings, existing.id, { value });
    } else {
      await createDoc(collections.settings, { key, value });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings] PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'key es requerido' }, { status: 400 });
    }

    await deleteMany(collections.settings, 'key', key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings] DELETE error:', error);
    return NextResponse.json({ error: 'Error al eliminar configuración' }, { status: 500 });
  }
}
