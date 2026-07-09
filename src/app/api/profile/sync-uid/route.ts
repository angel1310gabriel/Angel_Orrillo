import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, firebaseUid } = await request.json();
    if (!email || !firebaseUid) {
      return NextResponse.json({ error: 'email y firebaseUid requeridos' }, { status: 400 });
    }

    const profile = await db.profiles.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firebase_uid: true },
    });

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

    if (profile.firebase_uid !== firebaseUid) {
      await db.profiles.update({
        where: { id: profile.id },
        data: { firebase_uid: firebaseUid },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al sincronizar UID' }, { status: 500 });
  }
}
