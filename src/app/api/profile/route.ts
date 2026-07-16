import { NextRequest, NextResponse } from 'next/server';
import { findProfileByFirebaseUid, findProfileById, findProfileByEmail, findFirst } from '@/lib/firestore-db';
import { collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const email = searchParams.get('email');
  const documentNumber = searchParams.get('documentNumber');
  const phone = searchParams.get('phone');

  try {
    let profile = null;
    if (uid) {
      profile = await findProfileByFirebaseUid(uid).catch(() => null);
      if (!profile) {
        profile = await findProfileById(uid).catch(() => null);
      }
      if (!profile && email) {
        profile = await findProfileByEmail(email).catch(() => null);
      }
    } else if (documentNumber) {
      profile = await findFirst(collections.profiles, { documentNumber }).catch(() => null);
    } else if (phone) {
      profile = await findFirst(collections.profiles, { phone }).catch(() => null);
    } else {
      return NextResponse.json({ error: 'uid, documentNumber o phone requerido' }, { status: 400 });
    }

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

    // Handle both Timestamp and string dates
    const createdAt = profile.createdAt
      ? typeof profile.createdAt === 'string' ? profile.createdAt : profile.createdAt.toDate?.()?.toISOString() || new Date().toISOString()
      : null;

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email || '',
      role: profile.role,
      phone: profile.phone || null,
      documentNumber: profile.documentNumber || null,
      documentType: profile.documentType || 'dni',
      isActive: profile.isActive ?? true,
      address: profile.address || null,
      photoUrl: profile.photoUrl || null,
      dailyGoal: profile.dailyGoal || 0,
      createdAt,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}
