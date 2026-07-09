import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';


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

// GET /api/collectors - List all staff
export async function GET() {
  try {
    const profiles = await db.profiles.findMany({
      where: { role: { in: ['collector', 'supervisor', 'admin'] } },
      select: {
        id: true, email: true, name: true, role: true, phone: true, dni: true,
        is_active: true, created_at: true, document_type: true, address: true,
        daily_goal: true, photo_url: true,
      },
      orderBy: { name: 'asc' },
    });
    const zoneIds = await db.collector_zones.findMany({
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
      photoUrl: p.photo_url || null,
      createdAt: p.created_at?.toISOString() || new Date().toISOString(),
      zoneIds: zoneMap[p.id] || [],
      dailyGoal: p.daily_goal,
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
    const { name, password, documentType, documentNumber, phone, address, role, email } = body;

    if (!name || !name.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!password || password.length < 4) return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 });
    if (!role || !['admin', 'supervisor', 'collector'].includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 });

    const docType = documentType || 'dni';
    if (documentNumber) {
      if (docType === 'dni' && !/^\d{8}$/.test(documentNumber)) return NextResponse.json({ error: 'El DNI debe tener exactamente 8 dígitos' }, { status: 400 });
      if ((docType === 'carnet_extranjeria' || docType === 'pasaporte') && (!/^\d+$/.test(documentNumber) || documentNumber.length < 9 || documentNumber.length > 25)) return NextResponse.json({ error: 'El documento debe tener entre 9 y 25 dígitos' }, { status: 400 });
    }
    if (phone && !/^9\d{8}$/.test(phone)) return NextResponse.json({ error: 'El teléfono debe tener 9 dígitos y empezar con 9' }, { status: 400 });

    const fbEmail = email.trim().toLowerCase();

    // Create Firebase Auth user FIRST — fail if it doesn't work
    let firebaseUid: string;
    try {
      const result = await createFirebaseUser(fbEmail, password);
      firebaseUid = result.localId;
    } catch (fbErr: any) {
      return NextResponse.json({ error: `Firebase: ${fbErr.message}` }, { status: 400 });
    }

    // Create profile in PostgreSQL with Firebase UID as id
    try {
      const existing = await db.profiles.findFirst({
        where: { OR: [{ email: fbEmail }, ...(documentNumber ? [{ dni: documentNumber }] : [])] },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email o documento' }, { status: 409 });
      }

      const profile = await db.profiles.create({
        data: {
          firebase_uid: firebaseUid,
          name: name.trim(),
          email: fbEmail,
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
        },
      });

      // Audit log
      await db.audit_logs.create({
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
    const { id, name, phone, address, role, isActive, zoneIds, documentNumber, password } = body;
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    if (role && !['admin', 'supervisor', 'collector'].includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    if (phone && !/^9\d{8}$/.test(phone)) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
    if (documentNumber != null && !/^\d{8}$/.test(String(documentNumber))) return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });

    try {
      let existing = await db.profiles.findUnique({ where: { id } }).catch(() => null);
      if (!existing) existing = await db.profiles.findFirst({ where: { firebase_uid: id } });
      if (!existing && body.email) existing = await db.profiles.findFirst({ where: { email: { equals: body.email.trim(), mode: 'insensitive' } } });
      if (!existing) { return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 }); }
      const profileId = existing.id;

      const profile = await db.profiles.update({
        where: { id: profileId },
        data: {
          name: name != null ? name.trim() : existing.name,
          email: body.email != null ? body.email.trim().toLowerCase() : existing.email,
          phone: phone != null ? phone : existing.phone,
          address: address != null ? address : existing.address,
          role: role != null ? role : existing.role,
          is_active: isActive != null ? isActive : existing.is_active,
          dni: documentNumber != null ? documentNumber : existing.dni,
          photo_url: body.photoUrl != null ? body.photoUrl : existing.photo_url,
          daily_goal: body.dailyGoal != null ? parseFloat(body.dailyGoal) : existing.daily_goal,
        },
        select: {
          id: true, name: true, email: true, phone: true, address: true, role: true,
          is_active: true, document_type: true, dni: true, created_at: true, daily_goal: true,
          photo_url: true,
        },
      });

      if (existing.firebase_uid && (body.email !== undefined || body.password)) {
        const fbUpdate: Record<string, any> = { idToken: '', localId: existing.firebase_uid };
        if (body.email !== undefined) fbUpdate.email = body.email.trim();
        if (body.password) fbUpdate.password = body.password;
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbUpdate),
        }).catch(() => {});
      }

      if (zoneIds !== undefined && Array.isArray(zoneIds)) {
        await db.collector_zones.deleteMany({ where: { collector_id: profileId } });
        if (zoneIds.length > 0) {
          await db.collector_zones.createMany({
            data: zoneIds.map((zoneId: string) => ({ collector_id: profileId, zone_id: zoneId })),
          });
        }
      }

      await db.audit_logs.create({
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
        photoUrl: profile.photo_url,
      });
    } catch (err: any) {
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

    try {
      const profile = await db.profiles.findUnique({ where: { id } });
      if (!profile) { return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 }); }
      const activeLoans = await db.loans.findMany({
        where: { collector_id: id, status: { in: ['active', 'mora'] } },
        take: 1,
      });
      if (activeLoans.length > 0) {
        return NextResponse.json({ error: 'No se puede eliminar personal con préstamos activos' }, { status: 400 });
      }

      if (profile.firebase_uid) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: '', localId: profile.firebase_uid }),
        }).catch(() => {});
      }

      await db.profiles.delete({ where: { id } });

      await db.audit_logs.create({
        data: {
          action: 'DELETE', entityType: 'staff', entityId: id, entityName: profile.name,
          severity: 'warning', notes: `Personal eliminado: ${profile.name}`,
        },
      }).catch(() => {});

      return NextResponse.json({ message: 'Personal eliminado' });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Error al eliminar' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar personal' }, { status: 500 });
  }
}
