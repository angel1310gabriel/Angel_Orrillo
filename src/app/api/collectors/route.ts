import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'dni': return 'DNI';
    case 'carnet_extranjeria': return 'Carnet de Extranjería';
    case 'pasaporte': return 'Pasaporte';
    default: return type;
  }
}

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCYbYHvlGwOLY071631rtb2A-j0MVPQeMo';

async function createFirebaseUser(email: string, password: string): Promise<{ localId: string }> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) {
    if (data.error.message === 'EMAIL_EXISTS') throw new Error('El email ya está registrado en Firebase');
    throw new Error(data.error.message || 'Error al crear usuario en Firebase');
  }
  return { localId: data.localId };
}

function buildFirebaseEmail(name: string, documentNumber: string | null, phone: string | null, loginMethod: string): string {
  switch (loginMethod) {
    case 'dni': return `${documentNumber}@kc-cobranzas.app`;
    case 'phone': return `${phone}@phone.kc-cobranzas.app`;
    case 'fingerprint': return `${documentNumber || phone}@bio.kc-cobranzas.app`;
    default: return `${name.toLowerCase().replace(/\s+/g, '.')}@kc-cobranzas.app`;
  }
}

// GET /api/collectors - List all staff
export async function GET() {
  try {
    const prisma = new PrismaClient();
    const profiles = await prisma.profiles.findMany({
      where: { role: { in: ['collector', 'supervisor', 'admin'] } },
      select: {
        id: true, email: true, name: true, role: true, phone: true, dni: true,
        is_active: true, created_at: true, document_type: true, address: true,
        daily_goal: true,
        _count: { select: { loans: true, payments: true } },
      },
      orderBy: { name: 'asc' },
    });
    await prisma.$disconnect();

    const zoneIds = await prisma.collector_zones.findMany({
      select: { collector_id: true, zone_id: true },
    });
    const zoneMap: Record<string, string[]> = {};
    for (const z of zoneIds) {
      if (!zoneMap[z.collector_id]) zoneMap[z.collector_id] = [];
      if (!zoneMap[z.collector_id].includes(z.zone_id)) zoneMap[z.collector_id].push(z.zone_id);
    }

    const collectors = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || '',
      phone: p.phone || null,
      address: p.address || null,
      role: p.role,
      isActive: p.is_active ?? true,
      documentType: p.document_type || 'dni',
      documentNumber: p.dni || null,
      photoUrl: null,
      createdAt: p.created_at?.toISOString() || new Date().toISOString(),
      zoneIds: zoneMap[p.id] || [],
      dailyGoal: p.daily_goal,
      _count: p._count,
    }));

    return NextResponse.json({ collectors });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Error al obtener personal' }, { status: 500 });
  }
}

// POST /api/collectors - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, documentType, documentNumber, phone, address, role, loginMethod, email } = body;
    const lm = loginMethod || 'email';

    if (!name || !name.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!password || password.length < 4) return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 });
    if (!role || !['admin', 'supervisor', 'collector'].includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });

    const docType = documentType || 'dni';
    if (documentNumber) {
      if (docType === 'dni' && !/^\d{8}$/.test(documentNumber)) return NextResponse.json({ error: 'El DNI debe tener exactamente 8 dígitos' }, { status: 400 });
      if ((docType === 'carnet_extranjeria' || docType === 'pasaporte') && !/^\d{9}$/.test(documentNumber)) return NextResponse.json({ error: 'El documento debe tener exactamente 9 dígitos' }, { status: 400 });
    }
    if (phone && !/^9\d{8}$/.test(phone)) return NextResponse.json({ error: 'El teléfono debe tener 9 dígitos y empezar con 9' }, { status: 400 });

    // Build Firebase email
    const fbEmail = lm === 'email' && email ? email.trim().toLowerCase()
      : lm === 'dni' ? `${documentNumber}@kc-cobranzas.app`
      : lm === 'phone' ? `${phone}@phone.kc-cobranzas.app`
      : lm === 'fingerprint' ? `${documentNumber || phone}@bio.kc-cobranzas.app`
      : buildFirebaseEmail(name, documentNumber, phone, lm);

    // Create Firebase Auth user FIRST — fail if it doesn't work
    let firebaseUid: string;
    try {
      const result = await createFirebaseUser(fbEmail, password);
      firebaseUid = result.localId;
    } catch (fbErr: any) {
      return NextResponse.json({ error: `Firebase: ${fbErr.message}` }, { status: 400 });
    }

    // Create profile in PostgreSQL with Firebase UID as id
    const prisma = new PrismaClient();
    try {
      const existing = await prisma.profiles.findFirst({
        where: { OR: [{ email: fbEmail }, ...(documentNumber ? [{ dni: documentNumber }] : [])] },
      });
      if (existing) {
        await prisma.$disconnect();
        return NextResponse.json({ error: 'Ya existe un usuario con ese email o documento' }, { status: 409 });
      }

      const profile = await prisma.profiles.create({
        data: {
          id: firebaseUid,
          name: name.trim(),
          email: fbEmail,
          password,
          document_type: docType,
          dni: documentNumber || null,
          phone: phone || null,
          address: address || null,
          role,
          is_active: true,
          daily_goal: parseFloat(body.dailyGoal) || 0,
        },
        select: {
          id: true, name: true, email: true, phone: true, address: true, role: true,
          is_active: true, document_type: true, dni: true, created_at: true, daily_goal: true,
          _count: { select: { loans: true, payments: true } },
        },
      });

      await prisma.$disconnect();

      // Audit log
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'staff',
          entityId: profile.id,
          entityName: profile.name,
          severity: 'info',
          notes: `Personal registrado: ${profile.name} (${getDocumentTypeLabel(profile.document_type || 'dni')}: ${profile.dni || '—'}, Rol: ${profile.role}, Firebase: ${fbEmail})`,
        },
      }).catch(() => {});

      return NextResponse.json({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        role: profile.role,
        isActive: profile.is_active,
        documentType: profile.document_type || 'dni',
        documentNumber: profile.dni,
        createdAt: profile.created_at?.toISOString(),
        dailyGoal: profile.daily_goal,
        _count: profile._count,
      }, { status: 201 });
    } catch (dbErr: any) {
      // Rollback Firebase user if DB insert failed
      try {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: '', localId: firebaseUid }),
        });
      } catch {}
      await prisma.$disconnect().catch(() => {});
      return NextResponse.json({ error: dbErr.message || 'Error al guardar en base de datos' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Error al registrar personal' }, { status: 500 });
  }
}

// PUT /api/collectors - Update staff member
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, phone, address, role, isActive, zoneIds } = body;
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    if (role && !['admin', 'supervisor', 'collector'].includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    if (phone && !/^9\d{8}$/.test(phone)) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });

    const prisma = new PrismaClient();
    try {
      const existing = await prisma.profiles.findUnique({ where: { id } });
      if (!existing) { await prisma.$disconnect(); return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 }); }

      const profile = await prisma.profiles.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : existing.name,
          phone: phone !== undefined ? phone : existing.phone,
          address: address !== undefined ? address : existing.address,
          role: role !== undefined ? role : existing.role,
          is_active: isActive !== undefined ? isActive : existing.is_active,
        },
        select: {
          id: true, name: true, email: true, phone: true, address: true, role: true,
          is_active: true, document_type: true, dni: true, created_at: true, daily_goal: true,
          _count: { select: { loans: true, payments: true } },
        },
      });

      if (zoneIds !== undefined && Array.isArray(zoneIds)) {
        await prisma.collector_zones.deleteMany({ where: { collector_id: id } });
        if (zoneIds.length > 0) {
          await prisma.collector_zones.createMany({
            data: zoneIds.map((zoneId: string) => ({ collector_id: id, zone_id: zoneId })),
          });
        }
      }

      await prisma.$disconnect();

      await db.auditLog.create({
        data: {
          action: 'UPDATE', entityType: 'staff', entityId: profile.id, entityName: profile.name,
          severity: 'info', notes: `Personal actualizado: ${profile.name}`,
        },
      }).catch(() => {});

      return NextResponse.json({
        id: profile.id, name: profile.name, email: profile.email, phone: profile.phone,
        address: profile.address, role: profile.role, isActive: profile.is_active,
        documentType: profile.document_type || 'dni', documentNumber: profile.dni,
        createdAt: profile.created_at?.toISOString(), dailyGoal: profile.daily_goal,
        _count: profile._count,
      });
    } catch (err: any) {
      await prisma.$disconnect().catch(() => {});
      return NextResponse.json({ error: err.message || 'Error al actualizar' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar personal' }, { status: 500 });
  }
}

// DELETE /api/collectors - Delete staff member
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });

    const prisma = new PrismaClient();
    try {
      const profile = await prisma.profiles.findUnique({ where: { id }, include: { loans: true } });
      if (!profile) { await prisma.$disconnect(); return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 }); }
      if (profile.loans.some((l) => l.status === 'active' || l.status === 'mora')) {
        await prisma.$disconnect();
        return NextResponse.json({ error: 'No se puede eliminar personal con préstamos activos' }, { status: 400 });
      }

      await prisma.profiles.delete({ where: { id } });
      await prisma.$disconnect();

      await db.auditLog.create({
        data: {
          action: 'DELETE', entityType: 'staff', entityId: id, entityName: profile.name,
          severity: 'warning', notes: `Personal eliminado: ${profile.name}`,
        },
      }).catch(() => {});

      return NextResponse.json({ message: 'Personal eliminado' });
    } catch (err: any) {
      await prisma.$disconnect().catch(() => {});
      return NextResponse.json({ error: err.message || 'Error al eliminar' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar personal' }, { status: 500 });
  }
}
