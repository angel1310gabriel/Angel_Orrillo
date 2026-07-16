import { NextRequest, NextResponse } from 'next/server';
import { findProfileByEmail, findProfileById, updateProfile } from '@/lib/firestore-db';
import { requireAuth } from '@/lib/route-guard';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { email, firebaseUid } = await request.json();
    if (!email || !firebaseUid) {
      return NextResponse.json({ error: 'email y firebaseUid requeridos' }, { status: 400 });
    }

    if (auth.uid !== firebaseUid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    let profile = await findProfileByEmail(email).catch(() => null);
    if (!profile && firebaseUid) {
      profile = await findProfileById(firebaseUid).catch(() => null);
    }

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

    const cleanEmail = email.trim().toLowerCase();
    if (profile.email?.toLowerCase() !== cleanEmail || profile.firebaseUid !== firebaseUid) {
      await updateProfile(profile.id, {
        email: cleanEmail,
        firebaseUid,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error syncing UID:', error);
    return NextResponse.json({ error: 'Error al sincronizar UID' }, { status: 500 });
  }
}
