import { NextRequest, NextResponse } from 'next/server';
import { findFirst, collections } from '@/lib/firestore-db';
import { requireAuth } from '@/lib/route-guard';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dni = searchParams.get('dni');
  const phone = searchParams.get('phone');

  if (!dni && !phone) {
    return NextResponse.json({ error: 'dni o phone requerido' }, { status: 400 });
  }

  try {
    const where = dni ? { documentNumber: dni } : { phone };
    const profile = await findFirst(collections.profiles, where as Record<string, unknown>);

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      firebaseEmail: profile.email,
      firebaseUid: profile.firebaseUid,
      name: profile.name,
      id: profile.id,
    });
  } catch (error) {
    console.error('Error looking up profile:', error);
    return NextResponse.json({ error: 'Error al buscar usuario' }, { status: 500 });
  }
}
