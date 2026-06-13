import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// Helper for document type labels
function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'dni': return 'DNI';
    case 'carnet_extranjeria': return 'Carnet de Extranjería';
    case 'pasaporte': return 'Pasaporte';
    default: return type;
  }
}

// ============================================================
// Helper: Get Supabase client from env or DB settings
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Priority: service_role key (bypasses RLS for admin operations)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }

    // Fallback to DB settings (only available locally, not on Vercel)
    if (!isVercel) {
      const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
      const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
      const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });

      const url = urlSetting?.value;
      const key = serviceKeySetting?.value || keySetting?.value;
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(url, key);
      }
    }
  } catch {
    // Not configured
  }
  return null;
}

// GET /api/collectors - List all staff (admin, supervisor, collector)
export async function GET() {
  try {
    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { data, error } = await Promise.race([
          supabase.from('profiles').select('*').in('role', ['admin', 'supervisor', 'collector']).order('name'),
          new Promise<{ data: null; error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);

        if (!error && data && data.length > 0) {
          // Sync to local in background
          syncProfilesToLocal(data).catch(() => { });

          const collectors = data.map((p: Record<string, unknown>) => ({
            id: p.id,
            name: p.name,
            email: p.email || '',
            phone: p.phone || null,
            address: null,
            role: p.role,
            isActive: p.is_active ?? true,
            documentType: p.document_type || 'dni',
            documentNumber: p.dni || null,
            photoUrl: null,
            createdAt: p.created_at || new Date().toISOString(),
            _count: { loans: 0, payments: 0 },
          }));

          return NextResponse.json({ collectors, dataSource: 'supabase' });
        }
      } catch (error) {
        console.error('Supabase collectors failed, falling back:', error);
      }
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma (local SQLite)
    const collectors = await db.profile.findMany({
      where: { role: { in: ['collector', 'supervisor', 'admin'] } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        documentType: true,
        documentNumber: true,
        photoUrl: true,
        createdAt: true,
        _count: { select: { loans: true, payments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ collectors, dataSource: 'local' });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Error al obtener personal' }, { status: 500 });
  }
}

// POST /api/collectors - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, documentType, documentNumber, phone, address, role } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    }
    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 });
    }
    if (!role || !['admin', 'supervisor', 'collector'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido. Debe ser admin, supervisor o collector' }, { status: 400 });
    }

    // Validate document number based on type
    const docType = documentType || 'dni';
    if (documentNumber) {
      if (docType === 'dni' && !/^\d{8}$/.test(documentNumber)) {
        return NextResponse.json({ error: 'El DNI debe tener exactamente 8 dígitos' }, { status: 400 });
      }
      if ((docType === 'carnet_extranjeria' || docType === 'pasaporte') && !/^\d{9}$/.test(documentNumber)) {
        return NextResponse.json({ error: 'El Carnet de Extranjería / Pasaporte debe tener exactamente 9 dígitos numéricos' }, { status: 400 });
      }
    }

    // Validate phone
    if (phone && !/^9\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 9 dígitos y empezar con 9' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check duplicate email via Supabase
      const { data: existingEmail } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (existingEmail) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
      }

      // Check duplicate document number via Supabase
      if (documentNumber) {
        const { data: existingDoc } = await supabase.from('profiles').select('id').eq('dni', documentNumber).maybeSingle();
        if (existingDoc) {
          return NextResponse.json({ error: 'Ya existe un usuario con ese número de documento' }, { status: 409 });
        }
      }

      // Create via Supabase
      const profileId = crypto.randomUUID();
      const { data: newProfile, error: createError } = await supabase.from('profiles').insert({
        id: profileId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        document_type: docType,
        dni: documentNumber || null,
        phone: phone || null,
        role,
        is_active: true,
      }).select().single();

      if (createError) {
        console.error('[Collectors] Supabase create error:', createError.message);
        return NextResponse.json({ error: 'Error al registrar personal' }, { status: 500 });
      }

      return NextResponse.json({
        id: newProfile.id,
        name: newProfile.name,
        email: newProfile.email || '',
        phone: newProfile.phone || null,
        address: null,
        role: newProfile.role,
        isActive: newProfile.is_active ?? true,
        documentType: newProfile.document_type || 'dni',
        documentNumber: newProfile.dni || null,
        photoUrl: null,
        createdAt: newProfile.created_at || new Date().toISOString(),
        _count: { loans: 0, payments: 0 },
      }, { status: 201 });
    }

    // Local mode: Prisma-first with Supabase background push

    // Check duplicate email locally
    const existingEmail = await db.profile.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existingEmail) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }

    // Check duplicate document number locally
    if (documentNumber) {
      const existingDoc = await db.profile.findFirst({ where: { documentNumber } });
      if (existingDoc) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese número de documento' }, { status: 409 });
      }
    }

    // Create in local DB first (fast)
    const profile = await db.profile.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password, // Store plaintext to match auth route logic
        documentType: docType,
        documentNumber: documentNumber || null,
        phone: phone || null,
        address: address || null,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        documentType: true,
        documentNumber: true,
        photoUrl: true,
        createdAt: true,
        _count: { select: { loans: true, payments: true } },
      },
    });

    // Also push to Supabase in background (create auth user + profile)
    const supabase = await getSupabase();
    if (supabase) {
      pushProfileToSupabase(supabase, {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        password,
        documentType: docType,
        documentNumber: documentNumber || null,
        phone: phone || null,
        role,
      }).catch((err) => console.error('[Collectors] Push to Supabase error:', err));
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'staff',
        entityId: profile.id,
        entityName: profile.name,
        severity: 'info',
        notes: `Personal registrado: ${profile.name} (${getDocumentTypeLabel(profile.documentType)}: ${profile.documentNumber}, Rol: ${profile.role})`,
      },
    }).catch(() => { });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Error al registrar personal' }, { status: 500 });
  }
}

// PUT /api/collectors - Update staff member
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, phone, address, role, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Validate role if provided
    if (role && !['admin', 'supervisor', 'collector'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // Validate phone if provided
    if (phone && !/^9\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 9 dígitos y empezar con 9' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check existing via Supabase
      const { data: existingProfile, error: findError } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!existingProfile || findError) {
        return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
      }

      // Update via Supabase
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (phone !== undefined) updateData.phone = phone;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.is_active = isActive;

      const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update(updateData).eq('id', id).select().single();

      if (updateError) {
        console.error('[Collectors] Supabase update error:', updateError.message);
        return NextResponse.json({ error: 'Error al actualizar personal' }, { status: 500 });
      }

      return NextResponse.json({
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email || '',
        phone: updatedProfile.phone || null,
        address: null,
        role: updatedProfile.role,
        isActive: updatedProfile.is_active ?? true,
        documentType: updatedProfile.document_type || 'dni',
        documentNumber: updatedProfile.dni || null,
        photoUrl: null,
        createdAt: updatedProfile.created_at || new Date().toISOString(),
        _count: { loans: 0, payments: 0 },
      });
    }

    // Local mode: Prisma-first with Supabase background push
    const existing = await db.profile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
    }

    const profile = await db.profile.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        role: role !== undefined ? role : existing.role,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        documentType: true,
        documentNumber: true,
        photoUrl: true,
        createdAt: true,
        _count: { select: { loans: true, payments: true } },
      },
    });

    // Also push update to Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
          role: profile.role,
          is_active: profile.isActive,
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[Collectors] Update profile in Supabase error:', error.message);
        });
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'staff',
        entityId: profile.id,
        entityName: profile.name,
        severity: 'info',
        notes: `Personal actualizado: ${profile.name}`,
        changes: JSON.stringify({
          before: { name: existing.name, phone: existing.phone, role: existing.role, isActive: existing.isActive },
          after: { name: profile.name, phone: profile.phone, role: profile.role, isActive: profile.isActive },
        }),
      },
    }).catch(() => { });

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Error al actualizar personal' }, { status: 500 });
  }
}

// DELETE /api/collectors - Delete staff member
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check existing via Supabase
      const { data: profile, error: findError } = await supabase.from('profiles').select('id, name, document_type, dni').eq('id', id).maybeSingle();
      if (!profile || findError) {
        return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
      }

      // Check for active loans via Supabase
      const { data: activeLoans } = await supabase.from('loans').select('id').eq('collector_id', id).in('status', ['active', 'mora']);
      if (activeLoans && activeLoans.length > 0) {
        return NextResponse.json({ error: 'No se puede eliminar personal con préstamos activos' }, { status: 400 });
      }

      // Delete via Supabase
      const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id);
      if (deleteError) {
        console.error('[Collectors] Supabase delete error:', deleteError.message);
        return NextResponse.json({ error: 'Error al eliminar personal' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Personal eliminado' });
    }

    // Local mode: Prisma-first with Supabase background push
    const profile = await db.profile.findUnique({
      where: { id },
      include: { loans: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
    }

    if (profile.loans.some((l) => l.status === 'active' || l.status === 'mora')) {
      return NextResponse.json({ error: 'No se puede eliminar personal con préstamos activos' }, { status: 400 });
    }

    await db.profile.delete({ where: { id } });

    // Also delete from Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('profiles')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[Collectors] Delete profile from Supabase error:', error.message);
        });
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'staff',
        entityId: id,
        entityName: profile.name,
        severity: 'warning',
        notes: `Personal eliminado: ${profile.name} (${getDocumentTypeLabel(profile.documentType)}: ${profile.documentNumber})`,
      },
    }).catch(() => { });

    return NextResponse.json({ message: 'Personal eliminado' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Error al eliminar personal' }, { status: 500 });
  }
}

// ============================================================
// Helper: Push profile to Supabase (create auth user + profile row)
// ============================================================
async function pushProfileToSupabase(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  data: { id: string; name: string; email: string; password: string; documentType: string; documentNumber: string | null; phone: string | null; role: string }
) {
  try {
    // Try to insert profile row in Supabase
    const { error } = await supabase.from('profiles').upsert({
      id: data.id,
      name: data.name,
      email: data.email,
      document_type: data.documentType,
      dni: data.documentNumber,
      phone: data.phone,
      role: data.role,
      is_active: true,
    });

    if (error) {
      console.error('[Collectors] Push profile to Supabase error:', error.message);
    } else {
      console.log('[Collectors] Profile pushed to Supabase:', data.email);
    }
  } catch (err) {
    console.error('[Collectors] Push profile to Supabase error:', err);
  }
}

// ============================================================
// Helper: Sync profiles from Supabase to local DB
// ============================================================
async function syncProfilesToLocal(profiles: Record<string, unknown>[]) {
  // Skip sync on Vercel (no local DB)
  if (isVercel) return;

  try {
    for (const profile of profiles) {
      await db.profile.upsert({
        where: { id: profile.id as string },
        update: {
          email: profile.email as string,
          name: profile.name as string,
          role: profile.role as string,
          phone: (profile.phone as string) || null,
          documentNumber: (profile.dni as string) || null,
          isActive: (profile.is_active as boolean) ?? true,
        },
        create: {
          id: profile.id as string,
          email: profile.email as string,
          name: (profile.name as string) || (profile.email as string).split('@')[0],
          role: (profile.role as string) || 'collector',
          phone: (profile.phone as string) || null,
          documentNumber: (profile.dni as string) || null,
          password: 'synced_from_supabase',
          isActive: (profile.is_active as boolean) ?? true,
        },
      });
    }
    console.log(`[Collectors] Synced ${profiles.length} profiles from Supabase to local`);
  } catch (err) {
    console.error('[Collectors] Sync error:', err);
  }
}