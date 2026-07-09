import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dni = searchParams.get('dni');
  const phone = searchParams.get('phone');

  if (!dni && !phone) {
    return NextResponse.json({ error: 'dni o phone requerido' }, { status: 400 });
  }

  try {
    const where = dni ? { dni } : { phone };
    const profile = await db.profiles.findFirst({
      where: where as any,
      select: { email: true, firebase_uid: true, name: true, id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      firebaseEmail: profile.email,
      firebaseUid: profile.firebase_uid,
      name: profile.name,
      id: profile.id,
    });
  } catch (error) {
    console.error('Error looking up profile:', error);
    return NextResponse.json({ error: 'Error al buscar usuario' }, { status: 500 });
  }
}
