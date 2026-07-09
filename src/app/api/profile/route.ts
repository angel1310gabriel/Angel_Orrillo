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
        isActive: true, createdAt: true, documentType: true, address: true,
        photoUrl: true, dailyGoal: true,
      },
    });
    if (!profile) {
      profile = await db.profiles.findUnique({
        where: { id: uid },
        select: {
          id: true, name: true, email: true, role: true, phone: true, dni: true,
          isActive: true, createdAt: true, documentType: true, address: true,
          photoUrl: true, dailyGoal: true,
        },
      });
    }
    if (!profile && email) {
      profile = await db.profiles.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true, name: true, email: true, role: true, phone: true, dni: true,
          isActive: true, createdAt: true, documentType: true, address: true,
          photoUrl: true, dailyGoal: true,
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
      documentType: profile.documentType || 'dni',
      isActive: profile.isActive ?? true,
      address: profile.address || null,
      photoUrl: profile.photoUrl || null,
      dailyGoal: profile.dailyGoal,
      createdAt: profile.createdAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}
