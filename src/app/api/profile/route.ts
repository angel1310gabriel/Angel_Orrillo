import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'uid requerido' }, { status: 400 });

  try {
    const prisma = new PrismaClient();
    const profile = await prisma.profiles.findUnique({
      where: { id: uid },
      select: {
        id: true, name: true, email: true, role: true, phone: true, dni: true,
        is_active: true, created_at: true, document_type: true, address: true,
      },
    });
    await prisma.$disconnect();

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
      createdAt: profile.created_at?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}
