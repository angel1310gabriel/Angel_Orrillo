import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const email = searchParams.get('email');
  if (!uid) return NextResponse.json({ error: 'uid requerido' }, { status: 400 });

  try {
    let profile = await db.profiles.findFirst({
      where: { firebase_uid: uid },
      select: {
        id: true, name: true, email: true, role: true, phone: true, dni: true,
        is_active: true, created_at: true, document_type: true, address: true,
        photo_url: true, daily_goal: true,
      },
    });
    if (!profile) {
      profile = await db.profiles.findUnique({
        where: { id: uid },
        select: {
          id: true, name: true, email: true, role: true, phone: true, dni: true,
          is_active: true, created_at: true, document_type: true, address: true,
          photo_url: true, daily_goal: true,
        },
      });
    }
    if (!profile && email) {
      profile = await db.profiles.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true, name: true, email: true, role: true, phone: true, dni: true,
          is_active: true, created_at: true, document_type: true, address: true,
          photo_url: true, daily_goal: true,
        },
      });
    }

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email || '',
      role: profile.role,
      phone: profile.phone || null,
      documentNumber: profile.dni || null,
      documentType: profile.document_type || 'dni',
      isActive: profile.is_active ?? true,
      address: profile.address || null,
      photoUrl: profile.photo_url || null,
      dailyGoal: profile.daily_goal,
      createdAt: profile.created_at?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}
