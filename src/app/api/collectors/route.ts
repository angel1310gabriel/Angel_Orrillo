import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, findById, updateDoc, deleteDoc, findFirst, collections, findManyProfiles } from '@/lib/firestore-db';
import { requireRole } from '@/lib/route-guard';

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
    const profiles = await findManyProfiles({
      role: ['in', ['collector', 'supervisor', 'admin']],
    });

    const allProfiles = profiles.filter(p => ['collector', 'supervisor', 'admin'].includes(p.role));
    const zoneIds = await findMany(collections.collectorZones);
    const zoneMap: Record<string, string[]> = {};
    for (const z of zoneIds) {
      if (!zoneMap[z.collectorId]) zoneMap[z.collectorId] = [];
      if (!zoneMap[z.collectorId].includes(z.zoneId)) zoneMap[z.collectorId].push(z.zoneId);
    }

    const collectors = allProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || '',
      phone: p.phone || null,
      address: p.address || null,
      role: p.role,
      isActive: p.isActive ?? true,
      documentType: p.documentType || 'dni',
      documentNumber: p.documentNumber || null,
      photoUrl: p.photoUrl || null,
      createdAt: p.createdAt ? (typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toDate?.()?.toISOString() || new Date().toISOString()) : new Date().toISOString(),
      zoneIds: zoneMap[p.id] || [],
      dailyGoal: p.dailyGoal || 0,
      _count: { loans: 0, payments: 0 },
    }));

    return NextResponse.json({ collectors });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Error al obtener personal' }, { status: 500 });
  }
}

// POST /api/collectors - Create new staff member
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin']);
  if (auth instanceof NextResponse) return auth;

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

    // Check existing in Firestore
    const existing = await findFirst(collections.profiles, {
      OR: [{ email: fbEmail }, ...(documentNumber ? [{ documentNumber }] : [])] as any,
    }).catch(() => null);
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email o documento' }, { status: 409 });
    }

    // Create Firebase Auth user
    let firebaseUid: string;
    try {
      const result = await createFirebaseUser(fbEmail, password);
      firebaseUid = result.localId;
    } catch (fbErr: any) {
      return NextResponse.json({ error: `Firebase: ${fbErr.message}` }, { status: 400 });
    }

    // Create in Firestore
    try {
      const profile = await createDoc(collections.profiles, {
        firebaseUid,
        id: firebaseUid,
        name: name.trim(),
        email: fbEmail,
        documentType: docType,
        documentNumber: documentNumber || null,
        phone: phone || null,
        address: address || null,
        role,
        isActive: true,
        dailyGoal: parseFloat(body.dailyGoal) || 0,
        photoUrl: null,
      }, firebaseUid);

      // Audit log
      await createDoc(collections.auditLogs, {
        action: 'CREATE',
        entityType: 'staff',
        entityId: profile.id,
        entityName: profile.name,
        severity: 'info',
        notes: `Personal registrado: ${profile.name} (${getDocumentTypeLabel(profile.documentType || 'dni')}: ${profile.documentNumber || '—'}, Rol: ${profile.role}, Firebase: ${fbEmail})`,
      }).catch(() => {});

      return NextResponse.json(profile, { status: 201 });
    } catch (dbErr: any) {
      // Rollback Firebase user
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
  const auth = await requireRole(request, ['admin', 'supervisor']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, name, phone, address, role, isActive, zoneIds, documentNumber, password } = body;
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    if (role && !['admin', 'supervisor', 'collector'].includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    if (phone && !/^9\d{8}$/.test(phone)) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
    if (documentNumber != null && !/^\d{8}$/.test(String(documentNumber))) return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });

    try {
      let existing = await findById(collections.profiles, id);
      if (!existing && body.email) {
        existing = await findFirst(collections.profiles, { email: body.email.trim().toLowerCase() });
      }
      if (!existing) return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });

      const profileId = existing.id;
      const updateData: Record<string, unknown> = {};
      if (name != null) updateData.name = name.trim();
      if (body.email != null) updateData.email = body.email.trim().toLowerCase();
      if (phone != null) updateData.phone = phone;
      if (address != null) updateData.address = address;
      if (role != null) updateData.role = role;
      if (isActive != null) updateData.isActive = isActive;
      if (documentNumber != null) updateData.documentNumber = documentNumber;
      if (body.photoUrl != null) updateData.photoUrl = body.photoUrl;
      if (body.dailyGoal != null) updateData.dailyGoal = parseFloat(body.dailyGoal);

      const profile = await updateDoc(collections.profiles, profileId, updateData);

      // Update Firebase Auth if email or password changed
      if (existing.firebaseUid && (body.email !== undefined || body.password)) {
        const fbUpdate: Record<string, any> = { idToken: '', localId: existing.firebaseUid };
        if (body.email !== undefined) fbUpdate.email = body.email.trim();
        if (body.password) fbUpdate.password = body.password;
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbUpdate),
        }).catch(() => {});
      }

      // Handle zones
      if (zoneIds !== undefined && Array.isArray(zoneIds)) {
        const existingZones = await findMany(collections.collectorZones, { collectorId: profileId });
        for (const z of existingZones) {
          await deleteDoc(collections.collectorZones, z.id).catch(() => {});
        }
        for (const zoneId of zoneIds) {
          await createDoc(collections.collectorZones, {
            collectorId: profileId,
            zoneId,
          }).catch(() => {});
        }
      }

      await createDoc(collections.auditLogs, {
        action: 'UPDATE', entityType: 'staff', entityId: profile.id, entityName: profile.name,
        severity: 'info', notes: `Personal actualizado: ${profile.name}`,
      }).catch(() => {});

      return NextResponse.json(profile);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Error al actualizar' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar personal' }, { status: 500 });
  }
}

// DELETE /api/collectors - Delete staff member
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });

    try {
      const profile = await findById(collections.profiles, id);
      if (!profile) return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });

      // Check active loans
      const activeLoans = await findMany(collections.loans, {
        collectorId: id,
        status: ['in', ['active', 'mora']] as any,
      }).catch(() => []);
      if (activeLoans.length > 0) {
        return NextResponse.json({ error: 'No se puede eliminar personal con préstamos activos' }, { status: 400 });
      }

      // Delete Firebase Auth user
      if (profile.firebaseUid) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: '', localId: profile.firebaseUid }),
        }).catch(() => {});
      }

      // Delete from Firestore
      await deleteDoc(collections.profiles, id);

      await createDoc(collections.auditLogs, {
        action: 'DELETE', entityType: 'staff', entityId: id, entityName: profile.name,
        severity: 'warning', notes: `Personal eliminado: ${profile.name}`,
      }).catch(() => {});

      return NextResponse.json({ message: 'Personal eliminado' });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Error al eliminar' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar personal' }, { status: 500 });
  }
}
